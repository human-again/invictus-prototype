"""
Async job queue service for long-running comparisons
Supports job status tracking, cancellation, and progress streaming
"""
import uuid
import time
import asyncio
from typing import Dict, Optional, Callable, Any
from enum import Enum
from dataclasses import dataclass, asdict
import json
import os

from services.cache import get_cache


class JobStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class Job:
    """Job metadata"""
    job_id: str
    task_type: str
    status: JobStatus
    created_at: float
    updated_at: float
    progress: int  # 0-100
    total_items: int
    completed_items: int
    result: Optional[Dict] = None
    error: Optional[str] = None
    cancelled: bool = False


class JobQueue:
    """Simple in-memory job queue (can be extended with Redis/Celery)"""
    
    def __init__(self):
        self.jobs: Dict[str, Job] = {}
        self.cache = get_cache()
    
    def create_job(
        self,
        task_type: str,
        total_items: int = 1
    ) -> str:
        """Create a new job and return job_id"""
        job_id = str(uuid.uuid4())
        job = Job(
            job_id=job_id,
            task_type=task_type,
            status=JobStatus.PENDING,
            created_at=time.time(),
            updated_at=time.time(),
            progress=0,
            total_items=total_items,
            completed_items=0
        )
        self.jobs[job_id] = job
        self._save_job(job)
        return job_id
    
    def get_job(self, job_id: str) -> Optional[Job]:
        """Get job by ID"""
        # Try cache first
        cached = self.cache.get(f"job:{job_id}")
        if cached:
            job = Job(**cached)
            if job.job_id in self.jobs:
                return self.jobs[job.job_id]
            return job
        
        return self.jobs.get(job_id)
    
    def update_job_progress(
        self,
        job_id: str,
        completed_items: int,
        result: Optional[Dict] = None
    ):
        """Update job progress"""
        job = self.jobs.get(job_id)
        if not job:
            return
        
        job.completed_items = completed_items
        job.progress = int((completed_items / job.total_items) * 100) if job.total_items > 0 else 0
        job.updated_at = time.time()
        
        if result:
            if job.result is None:
                job.result = {}
            job.result.update(result)
        
        if job.completed_items >= job.total_items:
            job.status = JobStatus.COMPLETED
        
        self._save_job(job)
    
    def start_job(self, job_id: str):
        """Mark job as running"""
        job = self.jobs.get(job_id)
        if job:
            job.status = JobStatus.RUNNING
            job.updated_at = time.time()
            self._save_job(job)
    
    def complete_job(self, job_id: str, result: Dict):
        """Mark job as completed"""
        job = self.jobs.get(job_id)
        if job:
            job.status = JobStatus.COMPLETED
            job.result = result
            job.progress = 100
            job.completed_items = job.total_items
            job.updated_at = time.time()
            self._save_job(job)
    
    def fail_job(self, job_id: str, error: str):
        """Mark job as failed"""
        job = self.jobs.get(job_id)
        if job:
            job.status = JobStatus.FAILED
            job.error = error
            job.updated_at = time.time()
            self._save_job(job)
    
    def cancel_job(self, job_id: str) -> bool:
        """Cancel a job"""
        job = self.jobs.get(job_id)
        if job and job.status in [JobStatus.PENDING, JobStatus.RUNNING]:
            job.status = JobStatus.CANCELLED
            job.cancelled = True
            job.updated_at = time.time()
            self._save_job(job)
            return True
        return False
    
    def _save_job(self, job: Job):
        """Save job to cache"""
        self.cache.set(
            f"job:{job.job_id}",
            asdict(job),
            ttl=86400  # 24 hours
        )
    
    def get_job_status(self, job_id: str) -> Optional[Dict]:
        """Get job status as dictionary"""
        job = self.get_job(job_id)
        if not job:
            return None
        
        return {
            "job_id": job.job_id,
            "task_type": job.task_type,
            "status": job.status.value,
            "progress": job.progress,
            "total_items": job.total_items,
            "completed_items": job.completed_items,
            "created_at": job.created_at,
            "updated_at": job.updated_at,
            "result": job.result,
            "error": job.error
        }


# Global job queue
_job_queue: Optional[JobQueue] = None


def get_job_queue() -> JobQueue:
    """Get global job queue instance"""
    global _job_queue
    if _job_queue is None:
        _job_queue = JobQueue()
    return _job_queue


async def run_async_comparison(
    job_id: str,
    comparison_func: Callable,
    *args,
    **kwargs
) -> Dict:
    """Run comparison asynchronously and update job progress"""
    queue = get_job_queue()
    queue.start_job(job_id)
    
    try:
        # Run comparison (this would be the actual comparison logic)
        result = await comparison_func(*args, **kwargs)
        queue.complete_job(job_id, result)
        return result
    except Exception as e:
        queue.fail_job(job_id, str(e))
        raise

