from app.db.database import SessionLocal
from app.models.technician import Technician

def fix_certifications():
    """Update technician records to convert empty list or None certifications to empty dict."""
    db = SessionLocal()
    try:
        # Get all technicians
        techs = db.query(Technician).all()
        
        print("Before update:")
        for tech in techs:
            print(f"Technician {tech.id}: certifications={tech.certifications} (type={type(tech.certifications).__name__ if tech.certifications is not None else 'None'})")
        
        # Update any empty list or None certifications to empty dict
        updates_made = 0
        for tech in techs:
            if tech.certifications is None or (isinstance(tech.certifications, list) and len(tech.certifications) == 0):
                tech.certifications = {}
                updates_made += 1
        
        # Commit the changes
        if updates_made > 0:
            db.commit()
            print(f"\nUpdated {updates_made} technician record(s)")
        else:
            print("\nNo updates needed")
        
        # Verify the updates
        techs = db.query(Technician).all()
        print("\nAfter update:")
        for tech in techs:
            print(f"Technician {tech.id}: certifications={tech.certifications} (type={type(tech.certifications).__name__ if tech.certifications is not None else 'None'})")
            
    finally:
        db.close()

if __name__ == "__main__":
    fix_certifications() 