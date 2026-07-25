# TF Motor

This repository contains the TF Motor website and two separate family sites.
Everything is built with plain HTML, CSS, JavaScript, and PHP so it can run
directly on Simply.com.

## Websites

- `tfmotor.se`: the main TF Motor website in the project root.
- `husbil.tfmotor.se`: the family camper booking system in `husbil/`.
- `mariaochjohan.tfmotor.se`: the wedding website and photo gallery in
  `mariaochjohan/`.

## Local development

The TF Motor website can be previewed as a static site:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173/`.

The camper booking system requires PHP because authentication and bookings are
handled by `husbil/api.php`. If PHP is installed locally, run the complete
project with:

```bash
php -S localhost:4173 -t .
```

Open:

- TF Motor: `http://localhost:4173/`
- Camper booking: `http://localhost:4173/husbil/`
- Wedding website: `http://localhost:4173/mariaochjohan/`

## Local configuration

Production credentials and runtime data are not stored in Git.

```bash
cp contact-config.example.php contact-config.php
cp husbil/config.example.php husbil/config.php
```

Configure the contact recipients, database, and user password hashes locally.
`contact-config.php`, `husbil/config.php`, the booking database, and uploaded
wedding photos are ignored by Git.

## Camper booking

User accounts are configured in `husbil/config.php`. Only the safe
`husbil/config.example.php` template is version controlled.

The browser session remains active until the user signs out. Bookings are stored
in a shared database through `husbil/api.php`, ensuring that everyone sees the
same calendar.

The default setup uses SQLite at `husbil/data/husbil.sqlite`. On Simply.com, the
application can continue using SQLite if PHP has write access to that directory,
or it can use MySQL by changing the DSN in `husbil/config.php`.

Martin is the administrator and can edit or delete every booking. Other users
can only create, edit, and delete their own bookings.

## Deployment on Simply.com

Deploy the root files to `/public_html`.

The subdomains point to:

- `husbil.tfmotor.se` → `/public_html/husbil`
- `mariaochjohan.tfmotor.se` → `/public_html/mariaochjohan`

The contact form uses `contact.php`. Recipients are configured in the local
`contact-config.php`, which is not version controlled.

The TF Motor website displays the workshop address at Hallagärde Dammkärr 1,
516 95 Målsryd, phone number 070-585 66 89, and the slogan
“Lagar allt som brummar”.
