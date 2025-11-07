"""
Metrics and telemetry tracking service
Tracks timing, cost, success rates, and user ratings
"""
import time
import json
import os
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
from collections import defaultdict

from services.cache import get_cache


@dataclass
class ModelMetrics:
    """Metrics for a single model execution"""
    model_id: str
    task: str
    time_s: float
    tokens_in: int
    tokens_out: int
    cost: float
    success: bool
    timestamp: str
    user_rating: Optional[int] = None  # 1-5 or None


class MetricsTracker:
    """Tracks metrics for model performance"""
    
    def __init__(self, storage_path: Optional[str] = None):
        self.storage_path = storage_path or os.getenv(
            "METRICS_STORAGE_PATH",
            os.path.join(os.path.dirname(__file__), "..", "data", "metrics.json")
        )
        self.cache = get_cache()
        self.session_cost = 0.0
    
    def record_execution(
        self,
        model_id: str,
        task: str,
        time_s: float,
        tokens_in: int,
        tokens_out: int,
        cost: float,
        success: bool
    ):
        """Record a model execution"""
        metrics = ModelMetrics(
            model_id=model_id,
            task=task,
            time_s=time_s,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            cost=cost,
            success=success,
            timestamp=datetime.now().isoformat()
        )
        
        # Update session cost
        if success:
            self.session_cost += cost
        
        # Store in cache (for quick access)
        cache_key = f"metrics:{model_id}:{task}"
        recent_metrics = self.cache.get(cache_key) or []
        recent_metrics.append(asdict(metrics))
        # Keep only last 100 entries
        recent_metrics = recent_metrics[-100:]
        self.cache.set(cache_key, recent_metrics, ttl=86400)  # 24 hours
        
        # Also append to file (for persistence)
        self._append_to_file(metrics)
    
    def get_model_stats(self, model_id: str, task: Optional[str] = None) -> Dict:
        """Get aggregated statistics for a model"""
        # Load from cache first
        cache_key = f"metrics:{model_id}:{task or 'all'}"
        metrics_list = self.cache.get(cache_key) or []
        
        if not metrics_list:
            # Try loading from file
            metrics_list = self._load_from_file(model_id, task)
        
        if not metrics_list:
            return {
                "model_id": model_id,
                "task": task,
                "avg_time_s": 0.0,
                "success_rate": 0.0,
                "total_executions": 0,
                "avg_cost": 0.0,
                "avg_rating": 0.0
            }
        
        # Calculate aggregates
        total = len(metrics_list)
        successful = sum(1 for m in metrics_list if m.get("success", False))
        total_time = sum(m.get("time_s", 0) for m in metrics_list)
        total_cost = sum(m.get("cost", 0) for m in metrics_list)
        ratings = [m.get("user_rating") for m in metrics_list if m.get("user_rating")]
        avg_rating = sum(ratings) / len(ratings) if ratings else 0.0
        
        return {
            "model_id": model_id,
            "task": task,
            "avg_time_s": total_time / total if total > 0 else 0.0,
            "success_rate": (successful / total * 100) if total > 0 else 0.0,
            "total_executions": total,
            "avg_cost": total_cost / total if total > 0 else 0.0,
            "avg_rating": avg_rating
        }
    
    def get_task_stats(self, task: str) -> List[Dict]:
        """Get statistics for all models on a task"""
        # This would ideally query a database, but for now use file
        all_models = set()
        metrics_file = self.storage_path
        
        if os.path.exists(metrics_file):
            try:
                with open(metrics_file, "r") as f:
                    for line in f:
                        if line.strip():
                            data = json.loads(line)
                            if data.get("task") == task:
                                all_models.add(data.get("model_id"))
            except Exception:
                pass
        
        stats = []
        for model_id in all_models:
            stats.append(self.get_model_stats(model_id, task))
        
        # Sort by success rate and avg time
        stats.sort(key=lambda x: (x["success_rate"], -x["avg_time_s"]), reverse=True)
        return stats
    
    def rate_model(self, model_id: str, task: str, rating: int):
        """Record user rating for a model (1-5)"""
        if not (1 <= rating <= 5):
            return False
        
        # Update most recent execution for this model+task
        cache_key = f"metrics:{model_id}:{task}"
        metrics_list = self.cache.get(cache_key) or []
        
        if metrics_list:
            # Update the most recent one
            metrics_list[-1]["user_rating"] = rating
            self.cache.set(cache_key, metrics_list, ttl=86400)
        
        return True
    
    def get_session_cost(self) -> float:
        """Get cumulative session cost"""
        return self.session_cost
    
    def reset_session_cost(self):
        """Reset session cost counter"""
        self.session_cost = 0.0
    
    def _append_to_file(self, metrics: ModelMetrics):
        """Append metrics to file (one JSON line per entry)"""
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        try:
            with open(self.storage_path, "a") as f:
                f.write(json.dumps(asdict(metrics)) + "\n")
        except Exception as e:
            print(f"Error writing metrics: {e}")
    
    def _load_from_file(self, model_id: str, task: Optional[str]) -> List[Dict]:
        """Load metrics from file"""
        metrics_list = []
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, "r") as f:
                    for line in f:
                        if line.strip():
                            data = json.loads(line)
                            if data.get("model_id") == model_id:
                                if not task or data.get("task") == task:
                                    metrics_list.append(data)
            except Exception:
                pass
        return metrics_list[-100:]  # Return last 100


# Global metrics tracker
_metrics_tracker: Optional[MetricsTracker] = None


def get_metrics_tracker() -> MetricsTracker:
    """Get global metrics tracker instance"""
    global _metrics_tracker
    if _metrics_tracker is None:
        _metrics_tracker = MetricsTracker()
    return _metrics_tracker

