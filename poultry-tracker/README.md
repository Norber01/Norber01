# Poultry Tracker

A phone-friendly app for tracking a poultry (egg) business. It is built from the
**Income and Expenses** spreadsheet, uses the same orange header columns, and
works out the totals for you.

## What you enter each day

| Section | Fields |
|---|---|
| Eggs | Date, No. of eggs collected, Eggs giveaway |
| Sales | Price per crate, No. of crates sold |
| Feed | No. of feed bags bought, Price per bag |
| Other money | Other expense + amount, Money added to the business, Note |

## What it works out for you

- **Total Crate** = eggs collected ÷ 30
- **Total (sales)** = price per crate × crates sold
- **Income Generated** = running total of sales for the month
- **Total (feed)** = feed bags × price per bag
- **Income Left** = previous income left + sales + money added − feed − other expenses
- **Remaining Eggs** = previous remaining + eggs collected − (crates sold × 30) − giveaway

## Screens

- **Home**: eggs in stock, cash on hand, the latest day's eggs, average eggs per day, and this month's totals and profit
- **Records**: the full spreadsheet view, with every orange column; tap a row to edit it
- **Add**: record a day and see the calculated totals before you save
- **Summary**: totals for each month and for all time
- **Settings**: farm name, currency (GH₵ by default), eggs per crate, default prices, starting balances, number of birds (for laying rate), and backup/import

## Moving your Google Sheet in

1. In Google Sheets: **File → Download → Comma-separated values (.csv)** on the sales sheet.
2. In the app: **Settings → Import CSV from Google Sheets**.

Columns are matched by name (Date, No. of Eggs, price per Crate, no. of Crate sold,
No. of feed bought, price per bag, Note, other expenses, amount, Eggs Giveaway).
Dates such as `9/10/26` are read as day/month/year.

## Your data

Records are saved in the browser on your phone (no account needed, works offline).
Use **Download backup** regularly, and **Restore backup** to move to another phone.

## Running it

Open `index.html` in a browser, or host the folder on any static host
(for example GitHub Pages). Once it's hosted, use **Add to Home screen** to
install it as an app.
