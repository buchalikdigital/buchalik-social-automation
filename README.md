# Buchalik Social Automation

Rendert die Dark-Gold-Liquid-Glass-Postgrafik aus `queue/posts.json` und veröffentlicht sie automatisch auf Instagram, Facebook und LinkedIn. Läuft täglich über GitHub Actions — dein PC muss dafür nicht an sein.

## Funktionsprinzip

1. `queue/posts.json` enthält vorproduzierte, von dir freigegebene Posts (Bild-Variante + Bild-Inhalte + Captions pro Plattform).
2. Jeden Tag (Cron in `.github/workflows/daily-post.yml`) nimmt sich die Automation den nächsten noch nicht komplett geposteten Eintrag.
3. Rendert daraus zwei PNGs (Instagram 1080×1080, Facebook/LinkedIn 1200×630) via Playwright — dieselbe Technik, die wir schon manuell genutzt haben, nur jetzt scriptgesteuert.
4. Committet die PNGs nach `docs/images/`, die GitHub Pages öffentlich ausliefert (Instagram/Facebook brauchen eine öffentliche Bild-URL).
5. Postet über die offiziellen APIs. Jede Plattform wird einzeln als "erledigt" markiert — schlägt z.B. nur LinkedIn fehl, postet ein erneuter Lauf nicht doppelt auf Instagram/Facebook.

## Lokal testen (ohne zu posten)

```
npm install
npx playwright install chromium
npm run render                       # rendert alle Queue-Einträge
npm run render -- post-03-abo-statt-einmalpreis   # nur einen
```

Ergebnis landet in `docs/images/`. Damit lässt sich das Design prüfen, bevor überhaupt Zugangsdaten existieren.

## Bild-Varianten

Jeder Queue-Eintrag wählt über `variant` sein Layout; `fields` füllt dessen `{{PLATZHALTER}}`. Die Layouts liegen unter `templates/<variant>/{ig,fb}.html`, gemeinsame Markenwerte (Gold, Gradient, Glass-Effekt, Schriften) stehen zentral in `templates/_base.css`.

| Variante | Wofür | Felder |
| --- | --- | --- |
| `headline` | Eine Aussage, groß gesetzt — der Standard | `HEADLINE` |
| `vergleich` | Zwei Positionen gegenüberstellen, z.B. Preismodelle | `EYEBROW`, `LEFT_LABEL`, `LEFT_PRICE`, `LEFT_META`, `RIGHT_LABEL`, `RIGHT_PRICE`, `RIGHT_META` |

Bei `vergleich` bekommt das rechte Panel den Gold-Akzent, das linke bleibt gedämpft — die Hierarchie transportiert die Aussage also auch ohne Caption. Felder dürfen HTML enthalten (`<br>`, `<em>`, `<span class="per">` für die Einheit hinter einem Preis).

Eine neue Variante anlegen: Ordner unter `templates/` erstellen, `ig.html` (1080×1080) und `fb.html` (1200×630) hineinlegen, beide mit `{{BASE_CSS}}` am Anfang des `<style>`-Blocks.

## Setup — was du selbst erledigen musst

Ich kann diese Schritte nicht für dich ausführen, weil sie deinen Login und deine Zustimmung in Meta/LinkedIn brauchen. Danach übernimmt die Automation.

### 1. Meta (Instagram + Facebook)

1. Auf [developers.facebook.com](https://developers.facebook.com) einloggen, **"Meine Apps" → "App erstellen"** → Typ **"Business"**.
2. Produkt **"Instagram Graph API"** zur App hinzufügen.
3. Voraussetzung: dein Instagram-Account muss ein **Business- oder Creator-Konto** sein (Instagram-App → Einstellungen → Konto → Zu professionellem Konto wechseln) und mit einer **Facebook-Seite** verknüpft sein.
4. Im [Graph API Explorer](https://developers.facebook.com/tools/explorer/) einen **Page Access Token** generieren mit den Berechtigungen: `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`, `pages_manage_posts`.
5. Diesen Token über den **Access Token Debugger** in einen **langlebigen Token** umwandeln (60 Tage; muss danach erneuert werden — das ist eine bekannte Einschränkung der Graph API, kein Bug hier).
6. Notiere dir: `META_ACCESS_TOKEN` (der lange Token), `META_IG_USER_ID` (Instagram-Business-Account-ID, über `/me/accounts` + `/{page-id}?fields=instagram_business_account` im Explorer abrufbar), `META_PAGE_ID` (deine Facebook-Seiten-ID).

### 2. LinkedIn

1. Auf [linkedin.com/developers](https://www.linkedin.com/developers/apps) eine neue App erstellen, verknüpft mit einer LinkedIn-Seite (du brauchst eine, notfalls eine private Seite anlegen).
2. Unter **"Products"** das Produkt **"Share on LinkedIn"** beantragen.
   - **Ehrlicher Hinweis:** LinkedIn hat den Zugriff auf Posting-APIs in den letzten Jahren mehrfach verschärft. Ob "Share on LinkedIn" für eine neue App sofort freigeschaltet wird oder eine Prüfung durchläuft, kann ich nicht garantieren — das musst du im Developer Portal selbst sehen. Falls es nicht klappt: Instagram + Facebook laufen trotzdem automatisch, für LinkedIn bekommst du die fertige Grafik + den Text weiterhin aus `docs/images/` bzw. `queue/posts.json` zum manuellen Posten.
3. Nach Freigabe: OAuth-Flow einmal durchlaufen (Scope `w_member_social`), daraus einen Access Token gewinnen.
4. Deine Person-URN findest du z.B. über `GET https://api.linkedin.com/v2/me` mit dem Token — Format `urn:li:person:XXXXXXX`.
5. Notiere: `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_PERSON_URN`.

### 3. Repo, Pages, Secrets

Bereits erledigt (2026-07-25): Repo liegt öffentlich unter [github.com/buchalikdigital/buchalik-social-automation](https://github.com/buchalikdigital/buchalik-social-automation), GitHub Pages läuft ab `main`/`docs` (`https://buchalikdigital.github.io/buchalik-social-automation`), die Actions-Variable `PAGES_BASE_URL` ist gesetzt. Öffentlich, weil GitHub Pages bei privaten Repos einen bezahlten Plan braucht — im Repo liegen keine Zugangsdaten, nur Render-Code und die ohnehin öffentlichen Post-Texte.

Noch offen — sobald du die Tokens aus Schritt 1 und 2 hast:

1. **Settings → Secrets and variables → Actions → Secrets** im Repo: `META_ACCESS_TOKEN`, `META_IG_USER_ID`, `META_PAGE_ID`, `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_PERSON_URN` eintragen.
2. Unter **Actions** den Workflow **"Daily Social Post"** einmal manuell über **"Run workflow"** testen, bevor du dich auf den täglichen Cron verlässt.

## Neue Posts zur Warteschlange hinzufügen

Neuen Eintrag in `queue/posts.json` ergänzen (`headlineHtml` fürs Bild, `captions` pro Plattform, `posted` alle auf `false`). Reihenfolge im Array = Reihenfolge der Veröffentlichung. Ich helfe dir beim Batch-Produzieren neuer Posts — dann trägst du sie hier ein und die Automation übernimmt den Rest.

## Posting-Zeit ändern

`.github/workflows/daily-post.yml`, Zeile mit `cron: '0 7 * * *'` — Cron läuft in UTC, also z.B. `0 6 * * *` für 08:00 Uhr deutscher Winterzeit / 07:00 Uhr Sommerzeit (GitHub Actions rechnet Sommerzeit nicht automatisch um).
