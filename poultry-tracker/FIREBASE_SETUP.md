# Making the app live for everyone (Firebase)

Without Firebase, each phone keeps its own records. With Firebase, records, partner contributions,
comments and settings are stored online. When the sales manager or general manager adds a sale or
eggs collected, everyone who is logged in sees it within seconds, without reloading.

Firebase is free at this size. It takes about 10 minutes to set up.

## 1. Create the project

1. Go to <https://console.firebase.google.com> and sign in with a Google account.
2. Tap **Create a project** (or **Add project**). Name it `poultry-tracker`. Google Analytics can be turned off.

## 2. Turn on the database

1. In the left menu: **Build → Firestore Database → Create database**.
2. Pick a location close to you (for example `europe-west`) and choose **Start in production mode**.
3. Open the **Rules** tab, delete everything there, paste the whole of [`firestore.rules`](firestore.rules),
   and press **Publish**. These rules decide who can do what:
   - both managers can add, edit and delete daily records
   - only the general manager can change contributions, partners and settings
   - guests can only read and comment
   - nobody who isn't logged in can see anything

## 3. Turn on logins

1. In the left menu: **Build → Authentication → Get started**.
2. Under **Sign-in method**, pick **Email/Password**, switch on the first option, and **Save**.
3. Open the **Settings** tab → **Authorized domains** → **Add domain**, and add `norber01.github.io`.

You don't need to create any users. The first time someone logs in as the general manager, sales manager or
guest with that login's password, the app creates the account by itself.

## 4. Connect the app

1. Tap the gear icon → **Project settings**. Under **Your apps**, tap the **`</>`** (web) icon.
2. Name it `poultry-tracker` and tap **Register app** (no need for Firebase Hosting).
3. Firebase shows code with `const firebaseConfig = { ... }`. Copy the part between the curly brackets.
4. Open [`firebase-config.js`](firebase-config.js) on GitHub, tap the pencil to edit, and change the last line to:

   ```js
   window.FIREBASE_CONFIG = window.FIREBASE_CONFIG || {
     apiKey: "…",
     authDomain: "….firebaseapp.com",
     projectId: "…",
     storageBucket: "….appspot.com",
     messagingSenderId: "…",
     appId: "…"
   };
   ```

   using your values, then **Commit changes** to the `main` branch. (Or send the values to Claude to do it.)
   These values are meant to be public; the rules from step 2 protect the data.

## 5. First login

1. Wait 2–3 minutes, open the app link, and log in as the **general manager** first, on the phone that already has
   the records. That phone's records, partners, contributions, comments and settings are uploaded once, so everyone
   starts with them.
2. Then everyone else logs in as usual. The header shows **● Live** when the phone is connected.

## Good to know

- **No internet?** Changes are kept on the phone and sent when it's back online. The header then shows **Offline**.
- **Changing a password:** the general manager does it in **Settings → Passwords**. It needs the login's current
  password and changes it on every phone.
- **Who's who online:** the logins use the accounts `gm@poultry-tracker.app`, `sales@poultry-tracker.app` and
  `guest@poultry-tracker.app`. They show up under **Authentication → Users** after the first login. These aren't real
  email addresses.
