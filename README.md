# Buchalik Social Automation

Rendert die Dark-Gold-Liquid-Glass-Postgrafik aus `queue/posts.json` und veröffentlicht sie automatisch auf Instagram, Facebook und LinkedIn. Läuft täglich über GitHub Actions — dein PC muss dafür nicht an sein.

## Funktionsprinzip

1. `queue/posts.json` enthält vorproduzierte, von dir freigegebene Posts (Headline fürs Bild + Captions pro Plattform).
2. Jeden Tag (Cron in `.github/workflows/daily-post.yml`) nimmt sich die Automation den nächsten noch nicht komplett geposteten Eintrag.
3. Rendert daraus zwei PNGs (Instagram 1080×1080, Facebook/LinkedIn 1200×630) via Playwright — dieselbe Technik, die wir schon manuell genutzt haben, nur jetzt scriptgesteuert.
4. Committet die PNGs nach `docs/images/`, die GitHub Pages öffentlich ausliefert (Instagram/Facebook brauchen eine öffentliche Bild-URL).
5. Postet über die offiziellen APIs. Jede Plattform wird einzeln als "erledigt" markiert — schlägt z.B. nur LinkedIn fehl, postet ein erneuter Lauf nicht doppelt auf Instagram/Facebook.

## Lokal testen (ohne zu posten)

```
npm install
npx playwright install chromium
npm run render -- post-02-sauber-programmiert "Next.js 15, TypeScript.<br><em>Kein Baukasten-Code.</em>"
```

Ergebnis landet in `docs/images/`. Damit lässt sich das Design prüfen, bevor überhaupt Zugangsdaten existieren.

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

### 3. Repo auf GitHub + Secrets + Pages

1. Neues **privates** GitHub-Repo erstellen (z.B. unter deinem `buchalikdigital`-Account), dieses lokale Verzeichnis dorthin pushen.
2. **Settings → Pages**: Source = `Deploy from a branch`, Branch = `main`, Ordner = `/docs`. Danach ist die URL z.B. `https://buchalikdigital.github.io/buchalik-social-automation`.
3. **Settings → Secrets and variables → Actions → Secrets**: `META_ACCESS_TOKEN`, `META_IG_USER_ID`, `META_PAGE_ID`, `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_PERSON_URN` eintragen.
4. **Settings → Secrets and variables → Actions → Variables**: `PAGES_BASE_URL` = die Pages-URL aus Schritt 2.
5. Unter **Actions** den Workflow **"Daily Social Post"** einmal manuell über **"Run workflow"** testen, bevor du dich auf den täglichen Cron verlässt.

## Neue Posts zur Warteschlange hinzufügen

Neuen Eintrag in `queue/posts.json` ergänzen (`headlineHtml` fürs Bild, `captions` pro Plattform, `posted` alle auf `false`). Reihenfolge im Array = Reihenfolge der Veröffentlichung. Ich helfe dir beim Batch-Produzieren neuer Posts — dann trägst du sie hier ein und die Automation übernimmt den Rest.

## Posting-Zeit ändern

`.github/workflows/daily-post.yml`, Zeile mit `cron: '0 7 * * *'` — Cron läuft in UTC, also z.B. `0 6 * * *` für 08:00 Uhr deutscher Winterzeit / 07:00 Uhr Sommerzeit (GitHub Actions rechnet Sommerzeit nicht automatisch um).
