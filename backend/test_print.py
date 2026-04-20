import sys
print("---- PYTHON TEST PRINT TO STDOUT ----")
sys.stderr.write("---- PYTHON TEST PRINT TO STDERR ----\n")
print(f"Python version: {sys.version}")
print(f"Executable: {sys.executable}") 