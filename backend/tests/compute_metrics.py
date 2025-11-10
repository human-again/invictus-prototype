"""
Compute and validate performance metrics
"""
import json
import sys
from typing import Dict

def validate_metrics(test_results: Dict) -> Dict:
    """
    Validate performance metrics against success criteria
    
    Success criteria:
    - Response time < 5s per step
    - Extraction accuracy >= 70%
    - End-to-end success >= 80%
    """
    all_steps = []
    for result in test_results.get("results", []):
        for step_result in result.get("results", []):
            all_steps.append(step_result)
    
    # Calculate average latency per step
    step_latencies = {}
    for step_result in all_steps:
        step = step_result.get("step", "unknown")
        latency = step_result.get("latency", 0)
        if step not in step_latencies:
            step_latencies[step] = []
        step_latencies[step].append(latency)
    
    avg_latencies = {
        step: sum(latencies) / len(latencies)
        for step, latencies in step_latencies.items()
    }
    
    # Check response time criterion (< 5s per step)
    max_latency = max(avg_latencies.values()) if avg_latencies else 0
    response_time_ok = max_latency < 5.0
    
    # Calculate end-to-end success rate
    total = test_results.get("total_tested", 0)
    successful = test_results.get("successful", 0)
    success_rate = test_results.get("success_rate", 0)
    end_to_end_ok = success_rate >= 80.0
    
    # Calculate extraction accuracy (simplified - based on successful extractions)
    extraction_results = [
        r for r in all_steps if r.get("step") in ["methods_extraction", "protocol_summarization"]
    ]
    extraction_success = sum(1 for r in extraction_results if r.get("success", False))
    extraction_total = len(extraction_results)
    extraction_accuracy = (extraction_success / extraction_total * 100) if extraction_total > 0 else 0
    extraction_ok = extraction_accuracy >= 70.0
    
    validation_result = {
        "response_time": {
            "criterion": "< 5s per step",
            "max_latency": max_latency,
            "avg_latencies": avg_latencies,
            "passed": response_time_ok
        },
        "extraction_accuracy": {
            "criterion": ">= 70%",
            "actual": extraction_accuracy,
            "passed": extraction_ok
        },
        "end_to_end_success": {
            "criterion": ">= 80%",
            "actual": success_rate,
            "passed": end_to_end_ok
        },
        "overall_validation": {
            "all_criteria_met": response_time_ok and extraction_ok and end_to_end_ok,
            "summary": {
                "response_time": "✓" if response_time_ok else "✗",
                "extraction_accuracy": "✓" if extraction_ok else "✗",
                "end_to_end_success": "✓" if end_to_end_ok else "✗"
            }
        }
    }
    
    return validation_result


def generate_validation_report():
    """Generate validation report from test results"""
    try:
        with open("test_results.json", "r") as f:
            test_results = json.load(f)
    except FileNotFoundError:
        print("Error: test_results.json not found. Run test_e2e.py first.")
        return
    
    metrics = validate_metrics(test_results)
    
    report = {
        "test_summary": {
            "total_tested": test_results.get("total_tested", 0),
            "successful": test_results.get("successful", 0),
            "success_rate": test_results.get("success_rate", 0)
        },
        "performance_metrics": metrics,
        "test_details": test_results.get("results", [])
    }
    
    # Save validation report
    with open("../validation_report.json", "w") as f:
        json.dump(report, f, indent=2)
    
    # Print summary
    print("=" * 60)
    print("Validation Report")
    print("=" * 60)
    print(f"\nTest Summary:")
    print(f"  Total tested: {report['test_summary']['total_tested']}")
    print(f"  Successful: {report['test_summary']['successful']}")
    print(f"  Success rate: {report['test_summary']['success_rate']:.1f}%")
    
    print(f"\nPerformance Metrics:")
    print(f"  Response time: {metrics['response_time']['max_latency']:.2f}s (target: < 5s) {'✓' if metrics['response_time']['passed'] else '✗'}")
    print(f"  Extraction accuracy: {metrics['extraction_accuracy']['actual']:.1f}% (target: >= 70%) {'✓' if metrics['extraction_accuracy']['passed'] else '✗'}")
    print(f"  End-to-end success: {metrics['end_to_end_success']['actual']:.1f}% (target: >= 80%) {'✓' if metrics['end_to_end_success']['passed'] else '✗'}")
    
    print(f"\nOverall Validation:")
    if metrics['overall_validation']['all_criteria_met']:
        print("  ✓ All criteria met!")
    else:
        print("  ✗ Some criteria not met")
        print(f"    {metrics['overall_validation']['summary']}")
    
    print("\nValidation report saved to ../validation_report.json")


if __name__ == "__main__":
    generate_validation_report()









