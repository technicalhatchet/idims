import sys
import os
from pathlib import Path
from datetime import datetime # For timestamping

# --- File-based Debugging ---
debug_log_file_path = os.path.join(os.path.dirname(Path(__file__).resolve()), 'alembic_env_debug.log')
try:
    with open(debug_log_file_path, 'a') as f_debug:
        f_debug.write(f"[{datetime.now()}] ########### ENV.PY (RESTORED) IS BEING EXECUTED ###########\n")
except Exception as e_log_init:
    # This is a fallback if file logging itself fails. Should appear on console if stdout works at all here.
    print(f"CRITICAL: Failed to open/write initial entry to {debug_log_file_path}: {e_log_init}") 
# --- End File-based Debugging ---

from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context
import logging 

# Force Alembic logger to DEBUG level programmatically
# logging.getLogger('alembic').setLevel(logging.DEBUG) # We saw alembic logs, this might be redundant if fileConfig handles it

project_root = Path(__file__).parent.parent.resolve()
sys.path.insert(0, str(project_root))

config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    try:
        with open(debug_log_file_path, 'a') as f_debug:
            f_debug.write(f"[{datetime.now()}] About to call fileConfig for {config.config_file_name}\n")
    except Exception: pass
    fileConfig(config.config_file_name)
    try:
        with open(debug_log_file_path, 'a') as f_debug:
            f_debug.write(f"[{datetime.now()}] Called fileConfig successfully.\n")
    except Exception: pass


# Import the Base class from your database setup
from app.db.database import Base

# Import your models
from app.models.user import User
from app.models.client import Client
from app.models.technician import Technician
from app.models.work_order import WorkOrder, WorkOrderService, WorkOrderItem, WorkOrderNote, WorkOrderStatusHistory, WorkOrderAppointment
from app.models.client_appliance import ClientAppliance
from app.models.payment import Payment, PaymentMethod
from app.models.invoice import Invoice, InvoiceItem
from app.models.notification import Notification, NotificationTemplate
from app.models.service import Service, ServiceCategory
from app.models.quote import Quote, QuoteItem
from app.models.skill import Skill
from app.models.technician_skill import TechnicianSkill

target_metadata = Base.metadata

def my_process_revision_directives(context, revision, directives):
    try:
        with open(debug_log_file_path, 'a') as f_debug:
            f_debug.write(f"[{datetime.now()}] [DEBUG] my_process_revision_directives called\n")
            if directives:
                script = directives[0]
                f_debug.write(f"[{datetime.now()}] [DEBUG] Raw Upgrade OPS object: {script.upgrade_ops}\n")
                if hasattr(script.upgrade_ops, 'ops') and script.upgrade_ops.ops:
                    f_debug.write(f"[{datetime.now()}] [DEBUG] Iterating detected UPGRADE operations:\n")
                    for op_idx, op_item in enumerate(script.upgrade_ops.ops):
                        f_debug.write(f"[{datetime.now()}] [DEBUG] Op {op_idx}: {op_item}\n")
                else:
                    f_debug.write(f"[{datetime.now()}] [DEBUG] No detailed operations found in script.upgrade_ops.ops\n")
                
                f_debug.write(f"[{datetime.now()}] [DEBUG] Raw Downgrade OPS object: {script.downgrade_ops}\n")
                if hasattr(script.downgrade_ops, 'ops') and script.downgrade_ops.ops:
                    f_debug.write(f"[{datetime.now()}] [DEBUG] Iterating detected DOWNGRADE operations:\n")
                    for op_idx, op_item in enumerate(script.downgrade_ops.ops):
                        f_debug.write(f"[{datetime.now()}] [DEBUG] Op {op_idx}: {op_item}\n")
                else:
                    f_debug.write(f"[{datetime.now()}] [DEBUG] No detailed operations found in script.downgrade_ops.ops\n")
            else:
                f_debug.write(f"[{datetime.now()}] [DEBUG] No directives found for script processing.\n")
    except Exception as e_directive_log:
        # Fallback print if logging to file fails inside the hook
        # print(f"ERROR logging to file in my_process_revision_directives: {e_directive_log}")
        # Better to log the exception to the file if possible
        try:
            with open(debug_log_file_path, 'a') as f_debug_err:
                f_debug_err.write(f"[{datetime.now()}] ########### EXCEPTION IN my_process_revision_directives ###########\n{str(e_directive_log)}\nStack: {traceback.format_exc()}\n")
        except:
            pass # Ultimate fallback: do nothing if error logging also fails

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        process_revision_directives=my_process_revision_directives 
    )
    try:
        with open(debug_log_file_path, 'a') as f_debug:
            f_debug.write(f"[{datetime.now()}] Running migrations offline.\n")
    except Exception: pass
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    try:
        with open(debug_log_file_path, 'a') as f_debug:
            f_debug.write(f"[{datetime.now()}] Running migrations online with connectable: {connectable}\n")
            # Log tables in target_metadata
            if target_metadata:
                f_debug.write(f"[{datetime.now()}] Tables in target_metadata: {list(target_metadata.tables.keys())}\n")
            else:
                f_debug.write(f"[{datetime.now()}] target_metadata is None or empty.\n")
    except Exception: pass

    with connectable.connect() as connection:
        try:
            with open(debug_log_file_path, 'a') as f_debug:
                f_debug.write(f"[{datetime.now()}] Connection established: {connection}. Configuring context.\n")
        except Exception: pass
        context.configure(
            connection=connection, 
            target_metadata=target_metadata,
            process_revision_directives=my_process_revision_directives,
            compare_type=True,
            compare_server_default=True,
            include_schemas=True,
            render_as_batch=True
        )
        try:
            with open(debug_log_file_path, 'a') as f_debug:
                f_debug.write(f"[{datetime.now()}] Context configured with compare_type, compare_server_default, include_schemas, render_as_batch. Beginning transaction.\n")
        except Exception: pass
        with context.begin_transaction():
            context.run_migrations()
        try:
            with open(debug_log_file_path, 'a') as f_debug:
                f_debug.write(f"[{datetime.now()}] Migrations run, transaction ended.\n")
        except Exception: pass

# Main execution flow with file logging
try:
    if context.is_offline_mode():
        with open(debug_log_file_path, 'a') as f_debug:
            f_debug.write(f"[{datetime.now()}] Context is OFFLINE. Calling run_migrations_offline().\n")
        run_migrations_offline()
    else:
        with open(debug_log_file_path, 'a') as f_debug:
            f_debug.write(f"[{datetime.now()}] Context is ONLINE. Calling run_migrations_online().\n")
        run_migrations_online()
except Exception as e_main_flow:
    try:
        with open(debug_log_file_path, 'a') as f_debug:
            f_debug.write(f"[{datetime.now()}] ########### EXCEPTION IN ENV.PY MAIN FLOW ###########\n{str(e_main_flow)}\nStack: {traceback.format_exc()}\n")
    except:
        print(f"CRITICAL ERROR logging main flow exception: {e_main_flow}") # Last resort print
    raise
finally:
    try:
        with open(debug_log_file_path, 'a') as f_debug:
            f_debug.write(f"[{datetime.now()}] ########### ENV.PY (RESTORED) EXECUTION FINISHED ###########\n")
    except:
        print("CRITICAL ERROR logging env.py finish") # Last resort print
