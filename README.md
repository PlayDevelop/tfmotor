# TF Motor

Projektet innehåller tre webbplatser:

- `tfmotor.se`: filerna i projektroten.
- `husbil.tfmotor.se`: familjens husbilsbokning i `husbil/`.
- `mariaochjohan.tfmotor.se`: bröllopssida och bildgalleri i `mariaochjohan/`.

## Kör lokalt

TF Motor-sidan kan förhandsgranskas statiskt:

```bash
python3 -m http.server 4173
```

Öppna sedan `http://localhost:4173/`.

Husbilsbokningen behöver PHP eftersom login och bokningar går via `husbil/api.php`. Om PHP finns installerat lokalt kan hela projektet köras med:

```bash
php -S localhost:4173 -t .
```

Öppna då:

- TF Motor: `http://localhost:4173/`
- Husbilsbokning: `http://localhost:4173/husbil/`
- Bröllopssidan: `http://localhost:4173/mariaochjohan/`

## Lokal konfiguration

Produktionsuppgifter och driftdata ligger inte i Git.

```bash
cp contact-config.example.php contact-config.php
cp husbil/config.example.php husbil/config.php
```

Fyll sedan i kontaktmottagare, databas och användarnas lösenordshashar lokalt.
`contact-config.php`, `husbil/config.php`, bokningsdatabasen och uppladdade
bröllopsbilder ignoreras av Git.

## Husbilsbokningen

Inloggningar hanteras i `husbil/config.php`. Endast den ofarliga mallen
`husbil/config.example.php` versionshanteras.

Sessionen sparas i webbläsaren tills man loggar ut. Bokningar sparas i en gemensam databas via `husbil/api.php`, så alla ser samma kalender.

Standardläget använder SQLite i `husbil/data/husbil.sqlite`. På Simply kan databasen fortsätta vara SQLite om PHP-miljön har skrivbehörighet där, eller bytas till MySQL genom att ändra DSN i `husbil/config.php`.

Martin är admin och kan ändra/ta bort alla bokningar. Övriga användare kan bara skapa, ändra och ta bort sina egna bokningar.

## Publicering på Simply.com

Rotfilerna publiceras i `/public_html`.

Subdomänerna pekar på:

- `husbil.tfmotor.se` → `/public_html/husbil`
- `mariaochjohan.tfmotor.se` → `/public_html/mariaochjohan`

Kontaktformuläret använder `contact.php`. Mottagare anges i den lokala
`contact-config.php`, som inte versionshanteras.

TF Motor-sidan visar adressen `Hallagärde Dammkärr 1, 516 95 Målsryd`, telefon `070-585 66 89` och sloganen `Lagar allt som brummar`.
