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

## Logins

Everyone opens the same link, which goes straight to the login page:

`https://norber01.github.io/Norber01/poultry-tracker/`

Pick **General Manager**, **Sales Manager** or **Guest** and type that login's password. The general manager
and sales manager names are filled in automatically; guests type their own name. Passwords are built into
the app, so no device needs setting up. Only the general manager can see or change passwords, in
**Settings → Passwords**. With Firebase the change applies on every phone; without it, only on the phone where it was made. Closing the app or tab logs
you out, so the next person always starts at the login page.

| Login | Can do |
|---|---|
| General manager | Everything: daily records, partner contributions, partners, settings, passwords, backups |
| Sales manager | Add, edit and delete daily records; view everything; comment |
| Guest | View everything and comment only |

Everyone can comment on a day's record and on the Partners page. Each comment shows who wrote it.

## Partners

- **Partners' share**: each partner's total contribution and share % (their contributions ÷ all contributions).
  It starts with the contributions from the partners' sheet (Norbert, Ally, Frank, Isaac, Bernard).
- **Contributions**: one row per date with one column per partner, as in the sheet. The general manager can
  add a new contribution when partners invest more, edit or delete one, and add or rename partners.
- **Partners' income**: at the top of the Partners page, pick a month (for example October 2026) to see that
  month's sales, costs, profit and each partner's income, or pick **Total income** for all months together.
  Each month's profit (egg sales − feed − other expenses) is split by each partner's share at the end of that
  month, so new investment raises a partner's share from that month on. A table below lists every month.

## Screens

- **Home**: eggs in stock, cash on hand, the latest day's eggs, average eggs per day, and this month's totals and profit
- **Records**: the full spreadsheet view, with every orange column; tap a row to open it, comment, or edit
- **Add**: record a day and see the calculated totals before you save
- **Partners**: shares, contributions and monthly income per partner
- **Summary**: totals for each month and for all time
- **Settings**: farm name, currency (GH₵ by default), eggs per crate, default prices, starting balances, number of birds (for laying rate), and backup/import

## Moving your Google Sheet in

1. In Google Sheets: **File → Download → Comma-separated values (.csv)** on the sales sheet.
2. In the app: **Settings → Import CSV from Google Sheets**.

Columns are matched by name (Date, No. of Eggs, price per Crate, no. of Crate sold,
No. of feed bought, price per bag, Note, other expenses, amount, Eggs Giveaway).
Dates such as `9/10/26` are read as day/month/year.

## Your data

**Live for everyone (recommended):** connect the app to a free Firebase database by following
[FIREBASE_SETUP.md](FIREBASE_SETUP.md). Then records, contributions, comments and settings are stored online, and
when either manager adds a sale or eggs collected, everyone who is logged in sees it within seconds. The header
shows **● Live**. Logins are checked by Firebase, and the database rules in [firestore.rules](firestore.rules)
decide what each login may do, so the permissions can't be bypassed.

**Without Firebase:** records are saved only on the phone that entered them (the header says
"Saved on this phone only"). Use **Download backup** and **Restore backup** to move them to another phone.

## Running it

Open `index.html` in a browser, or host the folder on any static host
(for example GitHub Pages). Once it's hosted, use **Add to Home screen** to
install it as an app.
