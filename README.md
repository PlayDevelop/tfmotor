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

## Releases and automatic deployment

GitHub Actions validates every push and pull request. Production releases are
created manually from **Actions → Release and deploy → Run workflow**.

Select a `patch`, `minor`, or `major` increment. The workflow:

1. validates all JavaScript and PHP files;
2. calculates the next semantic version, starting at `v1.0.0`;
3. deploys the selected commit to Simply.com over SSH;
4. creates an annotated Git tag;
5. creates a GitHub Release with generated release notes.

The deployed site exposes `release.json`, containing the version, commit, and
deployment timestamp.

### Required GitHub secrets

Configure these under **Settings → Secrets and variables → Actions**:

| Secret | Description |
| --- | --- |
| `SIMPLY_SSH_HOST` | The Simply.com SSH/FTP hostname |
| `SIMPLY_SSH_USER` | The web hosting username |
| `SIMPLY_SSH_PRIVATE_KEY` | A dedicated private deployment key |
| `SIMPLY_SSH_KNOWN_HOSTS` | The verified SSH host-key entry |

Optional repository variables:

| Variable | Default | Description |
| --- | --- | --- |
| `SIMPLY_SSH_PORT` | `22` | SSH port |
| `SIMPLY_REMOTE_PATH` | `public_html` | Remote deployment directory |

Create a dedicated key pair:

```bash
ssh-keygen -t ed25519 -C "github-actions-tfmotor" -f simply_deploy_key
```

Add `simply_deploy_key.pub` under **Website → SSH access** in the Simply.com
control panel. Store the private `simply_deploy_key` file as the
`SIMPLY_SSH_PRIVATE_KEY` GitHub secret.

Create the known-hosts value after verifying the server fingerprint:

```bash
ssh-keyscan -p 22 YOUR_SIMPLY_HOST
```

Store the complete output as `SIMPLY_SSH_KNOWN_HOSTS`. Simply.com uses the same
hostname and username for SSH as for FTP. See the
[Simply.com SSH guide](https://www.simply.com/se/support/faq/php/349-anslut-med-ssh/)
for the control-panel steps.

The deployment excludes and preserves production-only files, including the
contact configuration, camper database and user configuration, wedding gallery
metadata, and all guest uploads.
