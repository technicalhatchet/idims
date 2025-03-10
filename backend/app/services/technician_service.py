from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import func, and_, or_, not_
from typing import Optional, Dict, List, Any, Union
from datetime import datetime, timedelta
import uuid
import logging

from app.models.technician import Technician
from app.models.user import User
from app.models.work_order import WorkOrder
from app.schemas.technician import TechnicianCreate, TechnicianUpdate
from app.core.exceptions import NotFoundException, ConflictException, ValidationException

logger = logging.getLogger(__name__)

class TechnicianService:
    """Service for handling technician operations"""
    
    @staticmethod
    async def get_technicians(
        db: Session, 
        search: Optional[str] = None,
        status: Optional[str] = None,
        skill: Optional[str] = None,
        skip: int = 0, 
        limit: int = 100
    ) -> Dict[str, Any]:
        """Get technicians with filtering and pagination"""
        query = db.query(Technician)
        
        # Apply filters
        if search:
            search_term = f"%{search}%"
            # Join with users to search by name or email
            query = query.join(User).filter(
                or_(
                    User.first_name.ilike(search_term),
                    User.last_name.ilike(search_term),
                    User.email.ilike(search_term),
                    Technician.employee_id.ilike(search_term)
                )
            )
        
        if status:
            query = query.filter(Technician.status == status)
        
        if skill:
            # Search for technicians who have the specified skill
            query = query.filter(Technician.skills.any(skill))
        
        # Get total count for pagination
        total = query.count()
        
        # Apply pagination
        query = query.order_by(Technician.created_at.desc())
        technicians = query.offset(skip).limit(limit).all()
        
        return {
            "total": total,
            "items": technicians,
            "page": skip // limit + 1,
            "pages": (total + limit - 1) // limit
        }
    
    @staticmethod
    async def get_technician(db: Session, technician_id: uuid.UUID) -> Technician:
        """Get a specific technician by ID"""
        technician = db.query(Technician).filter(Technician.id == technician_id).first()
        
        if not technician:
            raise NotFoundException(f"Technician with ID {technician_id} not found")
        
        return technician
    
    @staticmethod
    async def create_technician(db: Session, technician_data: TechnicianCreate, created_by: uuid.UUID) -> Technician:
        """Create a new technician"""
        # Check if a user account needs to be created or already exists
        user_id = technician_data.user_id
        
        if not user_id:
            if not technician_data.user_email:
                raise ValidationException("Either user_id or user_email must be provided")
            
            # Check if user already exists with provided email
            existing_user = db.query(User).filter(User.email == technician_data.user_email).first()
            
            if existing_user:
                # Check if this user is already a technician
                existing_tech = db.query(Technician).filter(Technician.user_id == existing_user.id).first()
                if existing_tech:
                    raise ConflictException(f"User with email {technician_data.user_email} is already a technician")
                
                # Use existing user
                user_id = existing_user.id
                
                # Update role if necessary
                if existing_user.role != "technician":
                    existing_user.role = "technician"
            else:
                # Create new user with technician role
                new_user = User(
                    email=technician_data.user_email,
                    first_name=technician_data.user_first_name or "",
                    last_name=technician_data.user_last_name or "",
                    role="technician",
                    is_active=True
                )
                
                db.add(new_user)
                db.flush()  # Get the ID
                user_id = new_user.id
        
        try:
            # Check if employee_id is unique if provided
            if technician_data.employee_id:
                existing = db.query(Technician).filter(Technician.employee_id == technician_data.employee_id).first()
                if existing:
                    raise ConflictException(f"Technician with employee ID {technician_data.employee_id} already exists")
            
            # Create new technician
            new_technician = Technician(
                user_id=user_id,
                employee_id=technician_data.employee_id,
                skills=technician_data.skills,
                certifications=technician_data.certifications,
                hourly_rate=technician_data.hourly_rate,
                availability=technician_data.availability or {
                    "workDays": ["monday", "tuesday", "wednesday", "thursday", "friday"],
                    "workHours": {
                        "start": "08:00",
                        "end": "17:00"
                    },
                    "exceptions": []
                },
                max_daily_jobs=technician_data.max_daily_jobs,
                notes=technician_data.notes,
                status=technician_data.status or "active",
                service_radius=technician_data.service_radius,
                location=technician_data.location
            )
            
            db.add(new_technician)
            db.commit()
            db.refresh(new_technician)
            
            return new_technician
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error creating technician: {str(e)}")
            raise ConflictException(f"Failed to create technician: {str(e)}")
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating technician: {str(e)}")
            raise ValidationException(f"Failed to create technician: {str(e)}")
    
    @staticmethod
    async def update_technician(db: Session, technician_id: uuid.UUID, technician_data: TechnicianUpdate) -> Technician:
        """Update an existing technician"""
        technician = await TechnicianService.get_technician(db, technician_id)
        
        try:
            # Validate employee_id uniqueness if being updated
            if technician_data.employee_id and technician_data.employee_id != technician.employee_id:
                existing = db.query(Technician).filter(
                    Technician.employee_id == technician_data.employee_id,
                    Technician.id != technician_id
                ).first()
                
                if existing:
                    raise ConflictException(f"Technician with employee ID {technician_data.employee_id} already exists")
            
            # Update technician with provided fields
            update_data = technician_data.dict(exclude_unset=True)
            
            for key, value in update_data.items():
                setattr(technician, key, value)
            
            db.commit()
            db.refresh(technician)
            
            return technician
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error updating technician: {str(e)}")
            raise ConflictException(f"Failed to update technician: {str(e)}")
        except Exception as e:
            db.rollback()
            logger.error(f"Error updating technician: {str(e)}")
            raise ValidationException(f"Failed to update technician: {str(e)}")
    
    @staticmethod
    async def delete_technician(db: Session, technician_id: uuid.UUID) -> bool:
        """Delete a technician"""
        technician = await TechnicianService.get_technician(db, technician_id)
        
        try:
            # Check for related records
            work_orders = db.query(WorkOrder).filter(
                WorkOrder.assigned_technician_id == technician_id,
                WorkOrder.status.in_(["pending", "scheduled", "in_progress"])
            ).count()
            
            if work_orders > 0:
                raise ConflictException(f"Cannot delete technician with {work_orders} active work orders")
            
            # Optional: Update user role if this is the only technician record for the user
            user = db.query(User).filter(User.id == technician.user_id).first()
            if user and user.role == "technician":
                # Check if user has other roles in the system
                # In a real system, you might check for other role mappings
                
                # For now, we'll just leave the user role as is, or could set to a default
                # user.role = "client"  # Default role
                pass
            
            # Delete the technician
            db.delete(technician)
            db.commit()
            
            return True
            
        except ConflictException:
            raise
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(f"Database error deleting technician: {str(e)}")
            raise ConflictException(f"Failed to delete technician: {str(e)}")
        except Exception as e:
            db.rollback()
            logger.error(f"Error deleting technician: {str(e)}")
            raise ValidationException(f"Failed to delete technician: {str(e)}")
    
    @staticmethod
    async def get_technician_workload(
        db: Session, 
        technician_id: uuid.UUID, 
        start_date: datetime, 
        end_date: datetime
    ) -> Dict[str, Any]:
        """Get a technician's workload and scheduled jobs for a period"""
        technician = await TechnicianService.get_technician(db, technician_id)
        
        # Get work orders assigned to this technician in the date range
        work_orders = db.query(WorkOrder).filter(
            WorkOrder.assigned_technician_id == technician_id,
            WorkOrder.scheduled_start >= start_date,
            WorkOrder.scheduled_start <= end_date
        ).all()
        
        # Initialize workload data
        workload = {
            "technician_id": str(technician.id),
            "technician_name": technician.name,
            "date_range": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            },
            "total_jobs": len(work_orders),
            "completed_jobs": 0,
            "in_progress_jobs": 0,
            "pending_jobs": 0,
            "scheduled_jobs": 0,
            "total_hours": 0,
            "jobs_by_day": {},
            "utilization_rate": 0,
            "jobs": []
        }
        
        # Calculate days in range
        days_in_range = (end_date - start_date).days + 1
        current_date = start_date.date()
        
        # Initialize jobs by day
        for _ in range(days_in_range):
            day_str = current_date.isoformat()
            workload["jobs_by_day"][day_str] = 0
            current_date += timedelta(days=1)
        
        # Process each work order
        for wo in work_orders:
            # Count by status
            if wo.status == "completed":
                workload["completed_jobs"] += 1
            elif wo.status == "in_progress":
                workload["in_progress_jobs"] += 1
            elif wo.status == "pending":
                workload["pending_jobs"] += 1
            elif wo.status == "scheduled":
                workload["scheduled_jobs"] += 1
            
            # Count jobs by day
            wo_date = wo.scheduled_start.date().isoformat()
            if wo_date in workload["jobs_by_day"]:
                workload["jobs_by_day"][wo_date] += 1
            
            # Calculate hours if scheduled times exist
            if wo.scheduled_start and wo.scheduled_end:
                duration_hours = (wo.scheduled_end - wo.scheduled_start).total_seconds() / 3600
                workload["total_hours"] += duration_hours
            
            # Format job for response
            client_name = "Unknown"
            if wo.client:
                client_name = wo.client.company_name or f"{wo.client.first_name} {wo.client.last_name}"
                
            workload["jobs"].append({
                "id": str(wo.id),
                "order_number": wo.order_number,
                "title": wo.title,
                "status": wo.status,
                "client_name": client_name,
                "scheduled_start": wo.scheduled_start.isoformat() if wo.scheduled_start else None,
                "scheduled_end": wo.scheduled_end.isoformat() if wo.scheduled_end else None,
                "actual_start": wo.actual_start.isoformat() if wo.actual_start else None,
                "actual_end": wo.actual_end.isoformat() if wo.actual_end else None,
                "priority": wo.priority,
                "location": wo.service_location.get("address") if wo.service_location else None
            })
        
        # Calculate utilization rate based on technician availability
        available_hours = 0
        
        # If technician has defined availability
        if technician.availability and "workDays" in technician.availability and "workHours" in technician.availability:
            work_days = technician.availability["workDays"]
            work_hours = technician.availability["workHours"]
            
            # Extract work hours
            try:
                start_hour, start_minute = map(int, work_hours["start"].split(':'))
                end_hour, end_minute = map(int, work_hours["end"].split(':'))
                
                hours_per_day = (end_hour + end_minute/60) - (start_hour + start_minute/60)
                
                # Count working days in the date range
                current_date = start_date.date()
                working_days = 0
                
                for _ in range(days_in_range):
                    day_name = current_date.strftime("%A").lower()
                    if day_name in work_days:
                        working_days += 1
                    current_date += timedelta(days=1)
                
                available_hours = working_days * hours_per_day
                
                # Consider exceptions if they exist
                if "exceptions" in technician.availability:
                    for exception in technician.availability["exceptions"]:
                        exception_date = datetime.fromisoformat(exception["date"]).date()
                        if start_date.date() <= exception_date <= end_date.date():
                            if not exception.get("available", False):
                                # Subtract a full day
                                available_hours -= hours_per_day
                            elif "working_hours" in exception:
                                # Adjust for different working hours
                                ex_start = exception["working_hours"]["start"].split(':')
                                ex_end = exception["working_hours"]["end"].split(':')
                                ex_hours = (int(ex_end[0]) + int(ex_end[1])/60) - (int(ex_start[0]) + int(ex_start[1])/60)
                                available_hours = available_hours - hours_per_day + ex_hours
            
            except (KeyError, ValueError):
                # Default to 8 hours per working day if format is incorrect
                working_days = days_in_range * (5/7)  # Estimate based on 5-day workweek
                available_hours = working_days * 8
        else:
            # Default calculation if no availability defined
            working_days = days_in_range * (5/7)  # Estimate based on 5-day workweek
            available_hours = working_days * 8
        
        # Calculate utilization rate
        if available_hours > 0:
            workload["utilization_rate"] = min(100, (workload["total_hours"] / available_hours) * 100)
        
        return workload
    
    @staticmethod
    async def get_technician_performance(db: Session, technician_id: uuid.UUID, period: str = "month") -> Dict[str, Any]:
        """Get performance metrics for a technician"""
        technician = await TechnicianService.get_technician(db, technician_id)
        
        # Set date range based on period
        now = datetime.utcnow()
        if period == "week":
            start_date = now - timedelta(days=now.weekday(), weeks=1)  # Last week's Monday
            end_date = start_date + timedelta(days=6)  # Last week's Sunday
            prev_start = start_date - timedelta(weeks=1)
            prev_end = end_date - timedelta(weeks=1)
            period_name = "Last Week"
        elif period == "month":
            # Start of last month
            if now.month == 1:
                start_date = datetime(now.year - 1, 12, 1)
            else:
                start_date = datetime(now.year, now.month - 1, 1)
            
            # End of last month
            if now.month == 1:
                end_date = datetime(now.year, 1, 1) - timedelta(days=1)
            else:
                end_date = datetime(now.year, now.month, 1) - timedelta(days=1)
            
            # Previous month for comparison
            if start_date.month == 1:
                prev_start = datetime(start_date.year - 1, 12, 1)
                prev_end = datetime(start_date.year, 1, 1) - timedelta(days=1)
            else:
                prev_start = datetime(start_date.year, start_date.month - 1, 1)
                prev_end = start_date - timedelta(days=1)
            
            period_name = f"{start_date.strftime('%B %Y')}"
        elif period == "quarter":
            # Current quarter
            current_quarter = (now.month - 1) // 3 + 1
            if current_quarter == 1:
                prev_quarter = 4
                prev_year = now.year - 1
            else:
                prev_quarter = current_quarter - 1
                prev_year = now.year
            
            # Last quarter start and end
            start_month = (prev_quarter - 1) * 3 + 1
            start_date = datetime(prev_year, start_month, 1)
            if prev_quarter == 4:
                end_date = datetime(prev_year + 1, 1, 1) - timedelta(days=1)
            else:
                end_date = datetime(prev_year, start_month + 3, 1) - timedelta(days=1)
            
            # Previous quarter for comparison
            if prev_quarter == 1:
                prev_prev_quarter = 4
                prev_prev_year = prev_year - 1
            else:
                prev_prev_quarter = prev_quarter - 1
                prev_prev_year = prev_year
            
            prev_start_month = (prev_prev_quarter - 1) * 3 + 1
            prev_start = datetime(prev_prev_year, prev_start_month, 1)
            if prev_prev_quarter == 4:
                prev_end = datetime(prev_prev_year + 1, 1, 1) - timedelta(days=1)
            else:
                prev_end = datetime(prev_prev_year, prev_start_month + 3, 1) - timedelta(days=1)
            
            period_name = f"Q{prev_quarter} {prev_year}"
        elif period == "year":
            # Last year
            start_date = datetime(now.year - 1, 1, 1)
            end_date = datetime(now.year, 1, 1) - timedelta(days=1)
            prev_start = datetime(now.year - 2, 1, 1)
            prev_end = datetime(now.year - 1, 1, 1) - timedelta(days=1)
            period_name = f"{start_date.year}"
        else:
            raise ValidationException(f"Invalid period: {period}")
        
        # Current period jobs
        work_orders = db.query(WorkOrder).filter(
            WorkOrder.assigned_technician_id == technician_id,
            or_(
                and_(WorkOrder.created_at >= start_date, WorkOrder.created_at <= end_date),
                and_(WorkOrder.scheduled_start >= start_date, WorkOrder.scheduled_start <= end_date),
                and_(WorkOrder.actual_start >= start_date, WorkOrder.actual_start <= end_date),
                and_(WorkOrder.actual_end >= start_date, WorkOrder.actual_end <= end_date)
            )
        ).all()
        
        # Previous period jobs for comparison
        prev_work_orders = db.query(WorkOrder).filter(
            WorkOrder.assigned_technician_id == technician_id,
            or_(
                and_(WorkOrder.created_at >= prev_start, WorkOrder.created_at <= prev_end),
                and_(WorkOrder.scheduled_start >= prev_start, WorkOrder.scheduled_start <= prev_end),
                and_(WorkOrder.actual_start >= prev_start, WorkOrder.actual_start <= prev_end),
                and_(WorkOrder.actual_end >= prev_start, WorkOrder.actual_end <= prev_end)
            )
        ).all()
        
        # Calculate metrics
        total_jobs = len(work_orders)
        completed_jobs = sum(1 for wo in work_orders if wo.status == "completed")
        completion_rate = (completed_jobs / total_jobs * 100) if total_jobs > 0 else 0
        
        prev_total_jobs = len(prev_work_orders)
        prev_completed_jobs = sum(1 for wo in prev_work_orders if wo.status == "completed")
        prev_completion_rate = (prev_completed_jobs / prev_total_jobs * 100) if prev_total_jobs > 0 else 0
        
        # Calculate average job duration
        total_duration = 0
        job_count_with_duration = 0
        for wo in work_orders:
            if wo.actual_start and wo.actual_end:
                duration = (wo.actual_end - wo.actual_start).total_seconds() / 60  # minutes
                total_duration += duration
                job_count_with_duration += 1
        
        avg_duration = total_duration / job_count_with_duration if job_count_with_duration > 0 else 0
        
        # Similar calculation for previous period
        prev_total_duration = 0
        prev_job_count_with_duration = 0
        for wo in prev_work_orders:
            if wo.actual_start and wo.actual_end:
                duration = (wo.actual_end - wo.actual_start).total_seconds() / 60
                prev_total_duration += duration
                prev_job_count_with_duration += 1
        
        prev_avg_duration = prev_total_duration / prev_job_count_with_duration if prev_job_count_with_duration > 0 else 0
        
        # Calculate metrics changes
        jobs_change = ((total_jobs - prev_total_jobs) / prev_total_jobs * 100) if prev_total_jobs > 0 else 0
        completion_rate_change = completion_rate - prev_completion_rate
        duration_change = ((avg_duration - prev_avg_duration) / prev_avg_duration * 100) if prev_avg_duration > 0 else 0
        
        # Format performance data
        performance = {
            "technician_id": str(technician.id),
            "technician_name": technician.name,
            "period": period_name,
            "date_range": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            },
            "metrics": [
                {
                    "name": "Total Jobs",
                    "value": total_jobs,
                    "comparison": jobs_change,
                    "target": None
                },
                {
                    "name": "Completed Jobs",
                    "value": completed_jobs,
                    "comparison": ((completed_jobs - prev_completed_jobs) / prev_completed_jobs * 100) if prev_completed_jobs > 0 else 0,
                    "target": None
                },
                {
                    "name": "Completion Rate",
                    "value": f"{completion_rate:.1f}%",
                    "comparison": completion_rate_change,
                    "target": 95.0
                },
                {
                    "name": "Average Job Duration",
                    "value": f"{avg_duration:.1f} minutes",
                    "comparison": duration_change,
                    "target": None
                }
            ]
        }
        
        return performance
    
    @staticmethod
    async def get_all_skills(db: Session) -> List[str]:
        """Get a unique list of all skills across all technicians"""
        technicians = db.query(Technician).all()
        
        # Collect all skills from all technicians
        all_skills = set()
        for tech in technicians:
            if tech.skills:
                all_skills.update(tech.skills)
        
        return sorted(list(all_skills))