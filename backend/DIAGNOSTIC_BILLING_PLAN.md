# Diagnostic vs Repair Billing System Implementation Plan

## Business Requirements Summary

### 1. Diagnostic Billing Logic
- Diagnostic is ALWAYS charged (never free)
- If repair is performed: Diagnostic gets discount applied (subtracted from repair price)
- Invoice shows: Diagnostic at full price, Repair at full price, Discount line, Net = repair price

### 2. Billing Triggers
- Services: Bill when appointment status = completed OR Phone Payment
- Parts: Bill when status = completed, Phone Payment, OR Up-front
- New statuses: Phone Payment for appointments, Up-front for parts

### 3. Invoice Display Structure
- Show ALL line items with visual indicators
- Amount Previously Paid line (always visible, even if .00)
- Due Today line (only completed/phone/up-front items)
- Total Work Order line (full amount)

### 4. Visual Indicators
- Icons: ✓ for paid/completed items, 💰 for due today
- Highlighting: Background color or font color for Due Today items

### 5. Status Restrictions
- Completed → Can only change to Redo or Refund
- Phone Payment → Can change to any other status (doesn't remove from invoice)

### 6. Admin Controls
- Manual overrides: Change billing status of any item
- Waive diagnostic fee: Admin-only option

## Files to Modify
- backend/app/models/work_order.py
- backend/app/schemas/work_order.py
- backend/app/routers/work_orders.py
- frontend/pages/work_orders/[id]/index.js
- frontend/components/work_orders/AppointmentScheduler.js

## Status: Ready for Implementation
Created: 09/21/2025 00:04:55
