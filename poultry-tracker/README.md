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

Share the normal link with everyone. It only ever shows the login page:

`https://norber01.github.io/Norber01/poultry-tracker/`

Only the general manager uses the **setup link**, once per device, to set the three passwords:

`https://norber01.github.io/Norber01/poultry-tracker/#setup`

After that, the setup link also just shows the login page. Passwords can only be seen and changed by
the general manager, in **Settings → Passwords**. Closing the app or tab logs you out, so the next
person always starts at the login page.

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
- **Partners' income each month**: each month's profit (egg sales − feed − other expenses) is split by
  each partner's share at the end of that month, so new investment raises a partner's share from that month on.

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

Records are saved in the browser on the device you use (works offline).
Use **Download backup** regularly, and **Restore backup** to move to another phone.

The logins control who can do what **on that device**. They do not share data between
phones, and someone who can open the browser's developer tools could get around them.
Sharing one set of records between several phones needs an online database
(for example Firebase or Supabase).

## Running it

Open `index.html` in a browser, or host the folder on any static host
(for example GitHub Pages). Once it's hosted, use **Add to Home screen** to
install it as an app.
