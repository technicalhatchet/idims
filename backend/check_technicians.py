from app.db.database import SessionLocal
from app.models.technician import Technician
from app.models.user import User

def check_technicians():
    db = SessionLocal()
    try:
        technicians = db.query(Technician).all()
        print(f'Found {len(technicians)} technicians:')
        
        for tech in technicians:
            user_id = tech.user_id
            user = db.query(User).filter(User.id == user_id).first()
            print(f'Technician ID: {tech.id}')
            print(f'  Employee ID: {tech.employee_id}')
            print(f'  User ID: {tech.user_id}')
            print(f'  User exists: {user is not None}')
            if user:
                print(f'  User email: {user.email}')
                print(f'  User name: {user.first_name} {user.last_name}')
            else:
                print(f'  User not found in database!')
            print('-' * 50)
    finally:
        db.close()

if __name__ == "__main__":
    check_technicians() 