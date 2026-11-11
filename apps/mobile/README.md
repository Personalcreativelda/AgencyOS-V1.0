# AgencyOS — app Android (Capacitor)

O app **não leva uma cópia do site**: ele abre o AgencyOS publicado (`CAP_SERVER_URL`).
Por isso, cada deploy do `apps/web` no Coolify já chega aos telemóveis na próxima vez que o app é aberto —
sem gerar APK novo e sem passar pela Play Store.

Só é preciso gerar outro APK quando muda algo **nativo**: o URL do servidor, o ícone, o nome, o `appId`
ou plugins do Capacitor.

## Gerar o APK

```bash
cd apps/mobile
CAP_SERVER_URL=https://app.seudominio.com npm run apk:debug
```

O APK fica em `apps/mobile/dist/AgencyOS-debug.apk` — instalável direto no telemóvel (ativar "instalar apps desconhecidas").

No PowerShell:

```powershell
$env:CAP_SERVER_URL="https://app.seudominio.com"; npm run apk:debug
```

Comando usado para o APK atual (produção):

```powershell
$env:CAP_SERVER_URL="https://agencyos.personalcreativemz.com"; $env:CAP_EXTRA_HOSTS="agencyapi.personalcreativemz.com"; npm run apk:debug
```

### Requisitos (já presentes nesta máquina)
- Android Studio (o script usa o JDK que vem com ele em `Android Studio\jbr`)
- Android SDK em `%LOCALAPPDATA%\Android\Sdk`
- O Gradle foi atualizado para 9.1.0 porque o JDK do Android Studio é a versão 25 (o Gradle 8.14 só suporta até Java 24).

## APK final (release assinada)

```powershell
$env:CAP_SERVER_URL="https://agencyos.personalcreativemz.com"; $env:CAP_EXTRA_HOSTS="agencyapi.personalcreativemz.com"; npm run apk:release
```

Gera `dist/AgencyOS-release.apk`, assinado com `android/agencyos-release.keystore`
(senha em `android/keystore.properties`). **Os dois ficheiros ficam fora do git — faça backup deles
num lugar seguro.** Sem essa chave não é possível publicar atualizações do mesmo app na Play Store
nem instalar uma versão nova por cima da atual.

Antes de cada APK novo para utilizadores, aumentar `versionCode` (e `versionName`) em `android/app/build.gradle`.

## Permissões

| Permissão | Para quê |
|---|---|
| Internet / estado da rede | abrir o AgencyOS e mostrar o ecrã "Sem conexão" |
| Câmera (opcional, pedida no primeiro uso) | opção "Câmera" ao enviar imagens |
| Galeria / fotos | **não é pedida**: o seletor do sistema dá acesso só às fotos escolhidas |
| Armazenamento (só Android 9 ou anterior) | downloads para a pasta Downloads |
| Notificações | preparado para notificações push |

## Como funciona
- `capacitor.config.ts` — `server.url` = `CAP_SERVER_URL`; `errorPath` mostra `www/offline.html` sem internet,
  que reconecta sozinho quando a ligação volta.
- `assets/` — origem do ícone e do splash (gerados com `node assets/make-sources.mjs` + `npx @capacitor/assets generate --android`).

## Limitações conhecidas
- **Ligar contas (Meta, Google, TikTok, LinkedIn):** o login dessas plataformas abre no navegador do telemóvel,
  não dentro do app, e o Google bloqueia login OAuth dentro de WebViews. Faça essas ligações pelo navegador
  (desktop ou telemóvel); depois de ligadas, os dados aparecem normalmente no app.
