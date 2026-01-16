from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional
import logging
from bullmq import Job
from app.jobs.queue_config import get_redis_connection
from app.api.dependencies.auth import get_current_user, CurrentUser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["jobs"])

class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: Optional[int] = None
    result: Optional[dict] = None
    failed_reason: Optional[str] = None

@router.get("/{job_id}/status", response_model=JobStatusResponse)
async def get_job_status(
    job_id: str,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get the status of a job."""
    try:
        redis_connection = get_redis_connection()
        
        # Try to get the job from lesson queue first
        job = await Job.fromId(redis_connection, job_id)
        
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job not found"
            )
            
        # Get job state
        state = await job.getState()
        
        response = JobStatusResponse(
            job_id=job_id,
            status=state
        )
        
        # Add progress if available
        if hasattr(job, 'progress') and job.progress:
            response.progress = job.progress
            
        # Add result if completed
        if state == "completed":
            response.result = job.returnvalue
            
        # Add failure reason if failed
        if state == "failed":
            response.failed_reason = str(job.failedReason) if job.failedReason else "Job failed"
            
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting job status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get job status"
        )