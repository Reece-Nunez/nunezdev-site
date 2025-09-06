# HubSpot Invoice Selector

## Overview
A comprehensive invoice preview and selective import system for HubSpot invoices.

## Features Added

### 1. Preview Mode API (`/api/hubspot/backfill/invoices`)
- **GET with `?preview=1`**: Shows preview of all HubSpot invoices without importing
- **GET without preview**: Normal bulk import (as before)
- **POST**: Selective import of chosen invoices

### 2. Invoice Selection Interface
- **Preview invoices** from HubSpot before importing
- **Select/deselect** individual invoices
- **Select All** importable invoices at once
- **Status indicators**: Already exists, can import, or skip reasons
- **Client matching**: Shows associated client name and email

### 3. Smart Import Logic
- **Prevents duplicates**: Won't import invoices that already exist
- **Client resolution**: Automatically finds or creates clients
- **Status mapping**: Maps HubSpot invoice statuses to your system
- **Error handling**: Clear feedback on what went wrong

## How to Use

### Step 1: Apply Database Schema
Run this SQL in your database:
```sql
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS hubspot_invoice_id text UNIQUE;
CREATE INDEX IF NOT EXISTS idx_invoices_hubspot_invoice_id ON invoices(hubspot_invoice_id);
```

### Step 2: Preview Invoices
1. Go to `/dashboard/hubspot`
2. Click "Preview HubSpot Invoices"
3. Review the list of invoices with status indicators

### Step 3: Select and Import
1. Check the invoices you want to import
2. Use "Select All Importable" for quick selection
3. Click "Import Selected (X)" to import chosen invoices

## Invoice Status Indicators

- **Can Import** (Green): Invoice can be imported
- **Already Exists** (Yellow): Invoice already in your system
- **No client email** (Red): HubSpot contact has no email address
- **Invalid amount** (Red): Invoice has no amount or invalid amount
- **No invoice number** (Red): Missing invoice number

## For Your Specific Case

This will help you find and import Chris Pinto's HubSpot invoice for $388, then you can use the existing `/admin/fix-stripe-payment` tool to link the Stripe payment to the imported invoice.

## API Endpoints

- `GET /api/hubspot/backfill/invoices?preview=1&limit=100` - Preview invoices
- `POST /api/hubspot/backfill/invoices` with `{selected_invoices: ["id1", "id2"]}` - Import selected

## Files Modified/Added

- `src/app/api/hubspot/backfill/invoices/route.ts` - Enhanced with preview & selective import
- `src/components/hubspot/InvoiceSelector.tsx` - New selection interface
- `src/app/dashboard/hubspot/page.tsx` - Updated with preview functionality
- `src/sql/add_hubspot_invoice_support.sql` - Database schema changes