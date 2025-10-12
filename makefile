# File: Makefile
PY := python
APP := grimm_dominion_vertical_slice.py

.PHONY: run web headless fmt

run:
	$(PY) $(APP) --width 960 --height 640

headless:
	# Useful for CI/tests; not interactive. Runs 2 seconds then exits.
	GD_HEADLESS=1 $(PY) $(APP) --headless --tick-seconds 2

web:
	# Runs a local web server via pygbag; open the forwarded port in Codespaces preview.
	# First run may take longer to compile; then it's hot-reloaded.
	pygbag --build $(APP) --host 0.0.0.0 --port 8000

fmt:
	python -m black $(APP)
