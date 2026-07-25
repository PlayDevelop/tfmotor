# Maria & Johan

Bröllopssida med mobilanpassad bilduppladdning och galleri.

## Lagring

Bilder laddas direkt till webbhotellet:

- optimerade större bilder sparas i `uploads/`
- små och snabba galleribilder sparas i `uploads/thumbs/`
- bildlistan sparas i `data/photos.json`

De sex fasta bilderna i `assets/photos/` visas alltid först. Gästbilder visas
därefter med den senast uppladdade först och 24 bilder åt gången.

## Simply

Ladda upp innehållet i denna mapp till:

```text
/public_html/mariaochjohan
```

Mapparna `data`, `uploads` och `uploads/thumbs` måste vara skrivbara för PHP.
Normal behörighet hos Simply är `755` för mappar. Använd `775` om uppladdning
misslyckas på grund av skrivbehörighet.

Vid framtida uppdateringar ska befintliga `data/photos.json` och `uploads/`
inte raderas, eftersom de innehåller gästernas bilder.
