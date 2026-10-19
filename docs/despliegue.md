# Instalación en oficina — paso a paso desde cero

Hay **tres tipos de máquina**. No se instala lo mismo en todas.

| Máquina | Qué hace | Qué se instala |
|---------|----------|----------------|
| **Su PC de desarrollo** (la suya) | Programa, hace `git push` | Node, Git, Docker (opcional), el repo |
| **PC principal de la oficina** (servidor) | Es la única que tiene la base y el sistema | Node, Git, Docker Desktop, PM2, mkcert, el repo |
| **PCs de trabajo** (2 o más) | Usan el sistema | Solo Chrome o Edge. Instalan la PWA. **Sin** Node, Git ni Docker |

Internet en la oficina sirve para clonar/actualizar el servidor. Si un día no hay internet, el sistema **sigue** en la red local con lo ya instalado.

La URL que van a usar las PCs de trabajo (reemplace la IP por la real):

```
https://192.168.1.50:3000
```

o, si configuró el nombre local:

```
https://contaduria.local:3000
```

---

# Parte A — En su PC de desarrollo (antes o el mismo día)

Haga esto **una vez** para que el código esté en Git y la oficina pueda bajarlo.

## A1. Tener el código en GitHub (o GitLab)

1. En su PC, abra una terminal en la carpeta del proyecto.
2. Confirme que hay remoto:

```bash
git remote -v
git status
```

3. Si hay cambios sin subir:

```bash
git add -A
git commit -m "Listo para instalar en oficina"
git push
```

4. Anote la URL del repo. Ejemplo:

```
https://github.com/SU-USUARIO/contaduria-municipal.git
```

Si el repo es **privado**, en la oficina Git le va a pedir usuario y un **token** (no la contraseña de GitHub). Cree un token en GitHub → Settings → Developer settings → Personal access tokens, con permiso `repo`, y téngalo a mano.

## A2. No desarrolle en la PC de la oficina

Siempre: cambia en su PC → `git push` → en la oficina solo se actualiza con el atajo **Actualizar Contaduría**.

---

# Parte B — PC principal de la oficina (servidor)

Elija una PC que:

- Quede **encendida** o se encienda cada mañana **antes** de que el resto trabaje.
- Esté en la **misma WiFi/red** que las demás.
- Tenga **internet** (aunque no siempre; hace falta para instalar y para actualizar).

Haga los pasos **en orden**. PowerShell o “Símbolo del sistema” como administrador cuando se indique.

## B1. IP fija (muy importante)

Si la IP del servidor cambia, las otras PCs dejan de entrar.

1. En el servidor, abra CMD:

```bat
ipconfig
```

2. Anote:
   - **Dirección IPv4** (ej. `192.168.1.50`)
   - **Máscara** (ej. `255.255.255.0`)
   - **Puerta de enlace** (ej. `192.168.1.1`)

3. Deje esa IP fija de **una** de estas formas (la que puedan hacer):
   - **Mejor:** en el router, reserva DHCP para el MAC de esa PC.
   - **O:** Windows → Configuración → Red e Internet → la WiFi/Ethernet → IPv4 manual con esos valores. DNS: `8.8.8.8` y `1.1.1.1`.

4. Escriba la IP en un papel. La va a usar muchas veces. En esta guía se llama `IP-SERVIDOR`.

## B2. Programas a instalar (solo en el servidor)

Instale **en este orden**, aceptando PATH cuando el instalador lo ofrezca. Cierre y abra la terminal después de cada uno.

1. **Git** — https://git-scm.com/download/win  
   Opciones por defecto. Marque “Git from the command line”.

2. **Node.js 20 LTS** (o 22 LTS) — https://nodejs.org  
   Instalador Windows, 64 bits.

3. **Docker Desktop** — https://www.docker.com/products/docker-desktop/  
   Incluye el motor Docker. Al terminar, **inicie Docker Desktop** y espere a que diga que está en marcha (ballena quieta).  
   En Settings → General: active **Start Docker Desktop when you log in**.

4. Compruebe en una terminal **nueva**:

```bat
git --version
node -v
npm -v
docker --version
```

`node -v` debe ser `v20` o superior.

5. PM2 (mantiene el sistema si se cae):

```bat
npm install -g pm2
```

## B3. Clonar el sistema

Elija una carpeta fija. Recomendado: `C:\contaduria`

```bat
cd C:\
git clone https://github.com/SU-USUARIO/contaduria-municipal.git contaduria
cd C:\contaduria
```

Si pide login: usuario de GitHub + el **token**.

Si ya copió el proyecto en un pendrive (sin Git), no es lo ideal para actualizar después. Prefiera `git clone`.

## B4. Archivo de entorno de producción

1. Copie el ejemplo:

```bat
copy .env.example apps\backend\.env
```

2. Abra `C:\contaduria\apps\backend\.env` con el Bloc de notas y déjelo **así** (Docker en esta PC):

```env
NODE_ENV=production
PORT=3000

DB_HOST=localhost
DB_PORT=5433
DB_NAME=contaduria
DB_USER=contaduria
DB_PASSWORD=contaduria_dev
DB_POOL_MAX=20

JWT_SECRET=CAMBIAR-POR-UN-TEXTO-LARGO-ALEATORIO-DE-MAS-DE-32-CARACTERES
JWT_EXPIRES_IN=8h

VITE_API_URL=/api
```

Notas:

- `DB_PORT=5433` es obligatorio con Docker de este proyecto (Postgres no se publica a la WiFi).
- `DB_PASSWORD=contaduria_dev` debe coincidir con Docker. No lo cambie salvo que también cambie `infra/docker/docker-compose.yml`.
- `JWT_SECRET`: invente una frase larga (mínimo 32 caracteres). No use la del ejemplo.
- Todavía **no** ponga `HTTPS_KEY_PATH` / `HTTPS_CERT_PATH` (van después de generar certificados).

3. Cree también `C:\contaduria\apps\frontend\.env` con una sola línea:

```env
VITE_API_URL=/api
```

## B5. Base de datos, dependencias, migraciones y primera carga

Docker Desktop tiene que estar **abierto**.

```bat
cd C:\contaduria
npm install
npm run db:up
```

Espere 10–20 segundos. Compruebe:

```bat
docker ps
```

Debe aparecer `contaduria-postgres`.

Luego:

```bat
npm run db:migrate
npm run db:seed
npm run build
```

`db:seed` crea el usuario inicial:

- Usuario: `admin`
- Contraseña: `Admin123!`

Eso se cambia **en cuanto entre** al sistema (paso B10).

Si `npm run db:up` falla: Docker Desktop no terminó de arrancar. Ábralo, espere, y reintente.

## B6. HTTPS (necesario para instalar la PWA en las otras PCs)

Sin HTTPS, Chrome/Edge en `http://192.168.x.x` **casi nunca** deja instalar la app.

### Instalar mkcert

En PowerShell **como administrador**:

```powershell
winget install FiloSottile.mkcert
```

Si `winget` no existe, use Chocolatey (`choco install mkcert`) o baje el `.exe` de https://github.com/FiloSottile/mkcert/releases y póngalo en el PATH.

Cierre y abra PowerShell **como administrador**:

```powershell
mkcert -install
```

Acepte el diálogo de Windows de “instalar certificado”.

### Generar certificados para esta red

En una terminal normal, en el proyecto (use **su** IP real):

```bat
cd C:\contaduria
npm run office:certs -- IP-SERVIDOR
```

Ejemplo:

```bat
npm run office:certs -- 192.168.1.50
```

Eso crea `C:\contaduria\infra\certs\` (no se sube a Git).

### Pegar las rutas en el `.env`

Abra de nuevo `apps\backend\.env` y **agregue al final** (con barras `/`):

```env
HTTPS_KEY_PATH=C:/contaduria/infra/certs/contaduria-key.pem
HTTPS_CERT_PATH=C:/contaduria/infra/certs/contaduria-cert.pem
```

### Dónde está la CA para las otras PCs

En el servidor:

```bat
mkcert -CAROOT
```

Ahí hay un archivo `rootCA.pem`. Cópielo a un pendrive. Lo va a importar **una vez** en cada PC de trabajo (Parte C).

## B7. Firewall de Windows (solo el puerto 3000)

En el **servidor**:

1. Panel de control → Sistema y seguridad → Firewall de Windows Defender → Configuración avanzada.
2. Reglas de entrada → Nueva regla → Puerto → TCP → **3000** → Permitir la conexión.
3. Márquela para **Privado** (red de oficina). No hace falta Público.
4. Nombre: `Contaduria-3000`.

**No** abra 5432 ni 5433. Postgres queda solo en esa PC.

## B8. Arrancar el sistema (PM2)

```bat
cd C:\contaduria
npx pm2 start ecosystem.config.cjs
npx pm2 save
```

Debe decir algo como `contaduria-api` **online**.

Compruebe en **esa misma PC**, Chrome:

```
https://127.0.0.1:3000
```

o

```
https://IP-SERVIDOR:3000
```

Puede avisar de certificado: continúe (en el servidor la CA ya está instalada con `mkcert -install`). Debe verse el login.

Ver logs si no arranca:

```bat
npx pm2 logs contaduria-api
```

Si dice que no conecta a PostgreSQL: Docker Desktop cerrado. Ábralo, `npm run db:up`, `npx pm2 restart contaduria-api`.

### Que arranque al encender Windows

1. Docker Desktop: ya debe iniciar con Windows (B2).
2. PM2 en Windows: en PowerShell **como administrador**:

```powershell
npm install -g pm2-windows-startup
pm2-startup install
cd C:\contaduria
npx pm2 save
```

Si `pm2-startup` falla, alternativa: Programador de tareas → al iniciar sesión del usuario, ejecutar:

```
C:\contaduria\infra\scripts\iniciar-servidor.bat
```

(ese archivo está en el repo; inicia Docker compose si hace falta y resucita PM2).

## B9. Atajo para actualizar (escritorio del servidor)

1. Vaya a `C:\contaduria\infra\scripts\actualizar-contaduria.bat`.
2. Clic derecho → Enviar a → Escritorio (crear acceso directo).
3. Renombre el acceso a **Actualizar Contaduría**.

Desde ahora, para una versión nueva: usted hace `git push` en su PC y en la oficina **doble clic** en ese icono. Las otras PCs no tocan nada: les sale el cartel y recargan.

## B10. Primer ingreso y seguridad

1. Entre con `admin` / `Admin123!`.
2. Cambie esa contraseña **ya** (usuarios del sistema).
3. Cree los usuarios reales (empleados) con rol adecuado.
4. Pruebe crear un expediente de prueba.

## B11. Nombre fácil `contaduria.local` (opcional pero cómodo)

En **cada** PC (servidor y clientes), Bloc de notas **como administrador** → abrir:

```
C:\Windows\System32\drivers\etc\hosts
```

Agregar al final (IP real):

```
192.168.1.50    contaduria.local
```

Guardar. Luego usarán `https://contaduria.local:3000`.

Si la IP del servidor cambia, hay que editar `hosts` en todas las PCs. Por eso la IP fija del B1.

---

# Parte C — Cada PC de trabajo (clientes)

**No** instale Node, Git, Docker ni clone el repo.

## C1. Misma red

La PC tiene que estar en la **misma WiFi/LAN** que el servidor. Apague VPN si molesta la red local.

## C2. Confiar el certificado (una sola vez)

Sin esto, el navegador muestra “No es seguro” y la PWA puede no instalarse.

1. Copie `rootCA.pem` del pendrive (el de `mkcert -CAROOT` en el servidor) a esa PC.
2. Doble clic en `rootCA.pem` (si Windows no lo abre, cambie la extensión a `.crt`).
3. Instalar certificado → **Máquina local** → Siguiente.
4. Marque **Colocar todos los certificados en el siguiente almacén** → Examinar → **Entidades de certificación raíz de confianza**.
5. Finalizar. Acepte la advertencia de seguridad.

Si no puede importar la CA: todavía pueden entrar con HTTPS aceptando el aviso, pero **Instalar app** en Chrome/Edge suele fallar. Conviene hacer la importación.

## C3. Abrir el sistema

Chrome o Edge (recomendado):

```
https://IP-SERVIDOR:3000
```

o

```
https://contaduria.local:3000
```

Debe verse el login, sin candado rojo.

## C4. Instalar como PWA

En Chrome/Edge, a la derecha de la barra de direcciones: icono **Instalar** / “Instalar Contaduria”, o el cartel de la propia pantalla.

Queda un icono en el escritorio o en el menú Inicio, como una aplicación. Los datos **no** viven en esa PC: todo está en el servidor.

## C5. Probar de verdad

Con dos PCs a la vez:

1. Login de dos usuarios distintos.
2. Crear un expediente en una, verlo en la otra (recargar listado).
3. Una afectación, un libramiento.

Si una PC no entra: firewall del servidor (B7), IP incorrecta, o no están en la misma red.

---

# Parte D — Cómo actualizar después (el día a día)

## En su PC

```bash
git add -A
git commit -m "Descripción del cambio"
git push
```

## En la PC principal de la oficina

1. Docker Desktop en marcha.
2. Doble clic en **Actualizar Contaduría**.
3. Espere a `=== Despliegue completado ===`.
4. Si falla, la versión **anterior sigue** corriendo. Lea el mensaje (suele ser internet, Git, o Docker apagado).

Eso hace: `git pull` → `npm install` → migraciones → build → reinicio PM2.

## En las PCs de trabajo

No hay que instalar nada. En 1–2 minutos (o al volver a la ventana) sale **“Nueva versión disponible”** → **Recargar ahora**.

---

# Parte E — Uso diario del servidor

Cada mañana, si la PC servidor se apagó:

1. Encenderla y entrar a Windows.
2. Esperar a que Docker Desktop quede en marcha (1–2 minutos).
3. Si PM2 no arrancó solo:

```bat
cd C:\contaduria
npm run db:up
npx pm2 resurrect
```

o el `iniciar-servidor.bat`.

4. Comprobar `https://IP-SERVIDOR:3000` desde otra PC.

No apague el servidor en horario de trabajo.

---

# Parte F — Respaldo de la base (haga esto el mismo día)

En el servidor, cree `C:\backups`.

Respaldo manual:

```bat
docker exec contaduria-postgres pg_dump -U contaduria contaduria > C:\backups\contaduria-manual.sql
```

Programe uno diario (Programador de tareas, cada noche). Conserve 7–14 copias.

---

# Checklist final (no cierre el día sin esto)

- [ ] IP del servidor anotada y fija
- [ ] Docker Desktop abre con Windows
- [ ] `npx pm2 status` muestra `contaduria-api` online
- [ ] `https://IP-SERVIDOR:3000` abre el login **desde otra PC**
- [ ] Certificado CA importado en las PCs de trabajo
- [ ] PWA instalada en cada puesto
- [ ] Contraseña de `admin` cambiada
- [ ] Acceso directo **Actualizar Contaduría** en el escritorio del servidor
- [ ] Puerto 3000 abierto en el firewall; 5433 cerrado a la red
- [ ] Prueba con 2 PCs a la vez
- [ ] Primera copia de respaldo de la base

---

# Si algo falla

| Problema | Qué revisar |
|----------|-------------|
| “No se pudo conectar al servidor” en las otras PCs | IP, misma WiFi, firewall puerto 3000, PM2 online |
| Login no carga / certificado rojo | Parte C2 (CA) o regenerar certs con la IP **actual** (`npm run office:certs -- IP`) y reiniciar PM2 |
| Error de PostgreSQL al arrancar | Docker Desktop abierto + `npm run db:up` |
| `git pull` pide clave | Token de GitHub; internet |
| `npm run deploy` falla a mitad | No se reinició PM2; se queda la versión vieja. Corrija y vuelva a ejecutar el `.bat` |
| PWA no ofrece “Instalar” | Tiene que ser **https** y la CA de confianza. Recargue. No use Firefox para instalar (Chrome/Edge) |
| Después de actualizar, pantalla en blanco | Cartel de recarga, o Ctrl+Shift+R. En PWA: Recargar ahora |

Comandos útiles **solo en el servidor**:

```bat
npx pm2 status
npx pm2 logs contaduria-api
npx pm2 restart contaduria-api
docker ps
npm run db:status
```
