# Instalación en oficina — paso a paso desde cero

Hay **tres tipos de máquina**. No se instala lo mismo en todas.

| Máquina | Qué hace | Qué se instala |
|---------|----------|----------------|
| **Su PC de desarrollo** (la suya) | Programa, hace `git push` | Node, Git, Docker (opcional), el repo |
| **PC principal de la oficina** (servidor) | Es la única que tiene la base y el sistema | Node, Git, Docker Desktop, PM2, mkcert, el repo |
| **PCs de trabajo** (2 o más) | Usan el sistema | Solo Chrome o Edge. Instalan la PWA. **Sin** Node, Git ni Docker |

Internet en la oficina sirve para clonar/actualizar el servidor. Si un día no hay internet, el sistema **sigue** en la red local con lo ya instalado.

## Si hoy no hay internet de la oficina (usa datos / hotspot)

**No perjudica** la red de la oficina. Bajar Git, Node, Docker y `npm install` por su celular o un hotspot es solo para descargar archivos.

Lo que **sí** cambia es la IP de la PC: en el hotspot tendrá una IP (por ejemplo `192.168.43.x`) y cuando la conecte al WiFi de la oficina tendrá **otra**. Las demás PCs de la oficina **no** ven el hotspot de su celular, así que no podrían usar el sistema todavía.

Haga así:

1. **Con su internet (hotspot):** instalar Git, Node, Docker, clonar el repo, `npm install`, `npm run db:up`, migraciones, seed, `npm run build`, PM2, mkcert (`mkcert -install`).
2. **Después, conectar esa PC al WiFi de la oficina** (aunque ese WiFi todavía no tenga internet).
3. Recién ahí: IP fija, **Cambiar red** (doble clic, como administrador), firewall, y las otras PCs con el kit `infra\certs\kit-clientes`.

No genere certificados ni anote “la IP definitiva” mientras esté en el hotspot. Cuando tenga internet de la oficina, las actualizaciones (`git pull` / Actualizar Contaduría) ya salen por esa red, sin volver al celular.

La URL que van a usar **siempre** las PCs de trabajo (no cambia aunque cambie la IP):

```
https://contaduria.local:3000
```

La IP se actualiza sola en segundo plano (archivo `hosts` + certificados) con el atajo **Cambiar red**.

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

Luego (esquema vacío + lo mínimo para entrar):

```bat
npm run db:migrate
npm run db:seed
npm run build
```

`db:migrate` solo crea las tablas. **No copia** expedientes, afectaciones ni saldos de ningún sistema anterior.

`db:seed` deja el sistema usable desde cero, sin datos de trabajo:

- roles y permisos
- usuario `admin` / `Admin123!` (cámbielo en el paso B10)
- nombre del sistema en configuración

Quedan **vacíos**: plan de cuentas, proveedores, expedientes, afectaciones, libramientos y pagos. Eso se carga desde la aplicación.

Si `npm run db:up` falla: Docker Desktop no terminó de arrancar. Ábralo, espere, y reintente.

Si `db:migrate` se cortó a mitad (por ejemplo en `008`): **no** ejecute `db:reset`. Corrija el archivo si hace falta y vuelva a `npm run db:migrate`; continúa desde la que faltaba.

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

### Generar certificados y acceso estable (`contaduria.local`)

Con la PC **ya en el WiFi de la oficina**, doble clic (clic derecho → Ejecutar como administrador):

`C:\contaduria\infra\scripts\cambiar-red.bat`

O en una terminal:

```bat
cd C:\contaduria
npm run office:red
```

Eso, sin pegar nada a mano:

- genera los certificados HTTPS (IP actual + `contaduria.local`)
- escribe `HTTPS_KEY_PATH` / `HTTPS_CERT_PATH` en `apps\backend\.env`
- pone `contaduria.local` en el `hosts` del servidor
- arma `C:\contaduria\infra\certs\kit-clientes` (pendrive para las otras PCs)
- reinicia PM2 si ya estaba corriendo

Copie al escritorio un acceso directo a `cambiar-red.bat` con el nombre **Cambiar red**.

### Kit para las otras PCs

La carpeta `infra\certs\kit-clientes` ya trae `rootCA.pem`, `oficina-ip.txt` y `configurar-acceso-cliente.bat`. Cópiela a un pendrive (Parte C).

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
https://contaduria.local:3000
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

## B9. Atajos en el escritorio del servidor

De `C:\contaduria\infra\scripts\`, envíe al escritorio:

| Archivo | Nombre del acceso | Para qué |
|---------|-------------------|----------|
| `actualizar-contaduria.bat` | **Actualizar Contaduría** | Nueva versión (git) |
| `cambiar-red.bat` | **Cambiar red** | Cambió el WiFi o la IP |
| `iniciar-servidor.bat` | **Iniciar servidor** | Si no arrancó solo al encender |

Para una versión nueva: `git push` en su PC y en la oficina doble clic en **Actualizar Contaduría**.

## B10. Primer ingreso y seguridad

1. Entre con `admin` / `Admin123!`.
2. Cambie esa contraseña **ya** (usuarios del sistema).
3. Cree los usuarios reales (empleados) con rol adecuado.
4. Pruebe crear un expediente de prueba.

## B11. Nombre estable `contaduria.local` (obligatorio para no sufrir el día que cambien la red)

No instale la PWA usando `https://192.168.x.x:3000`. Use siempre:

```
https://contaduria.local:3000
```

En el servidor lo deja **Cambiar red**. En cada PC de trabajo lo deja `configurar-acceso-cliente.bat` (Parte C).

El día que cambien el router o el WiFi, no se reinstala el sistema ni la PWA: solo se vuelve a correr **Cambiar red** en el servidor y el `.bat` de acceso en cada puesto.

---

# Parte C — Cada PC de trabajo (clientes)

**No** instale Node, Git, Docker ni clone el repo.

Copie a un pendrive la carpeta del servidor:

`C:\contaduria\infra\certs\kit-clientes`

## C1. Misma red

La PC tiene que estar en la **misma WiFi/LAN** que el servidor. Apague VPN si molesta la red local.

## C2. Confiar el certificado (una sola vez)

Sin esto, el navegador muestra “No es seguro” y la PWA puede no instalarse.

1. En el pendrive, `rootCA.pem` (si Windows no lo abre, cámbielo a `.crt`).
2. Instalar certificado → **Máquina local** → Siguiente.
3. Marque **Colocar todos los certificados en el siguiente almacén** → Examinar → **Entidades de certificación raíz de confianza**.
4. Finalizar. Acepte la advertencia de seguridad.

Si cambia la red más adelante, **no** hay que volver a instalar esta CA.

## C3. Apuntar `contaduria.local` (primera vez y si cambia la red)

Clic derecho en `configurar-acceso-cliente.bat` → **Ejecutar como administrador**.

Lee la IP de `oficina-ip.txt` (ya viene en el kit). Luego abra Chrome o Edge:

```
https://contaduria.local:3000
```

Debe verse el login, sin candado rojo. No use la IP para instalar la PWA.

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

# Parte D2 — Si mañana cambian el WiFi o la IP

No se reinstala Node, Docker ni la base. La PWA **tampoco** se reinstala si se abrió siempre como `https://contaduria.local:3000`.

1. Conecte el **servidor** a la red nueva y, si puede, deje IP fija de nuevo.
2. En el escritorio del servidor, **Cambiar red** (como administrador). Espere el mensaje de listo.
3. Copie de nuevo `C:\contaduria\infra\certs\kit-clientes` al pendrive (trae la IP nueva).
4. En **cada** PC de trabajo: `configurar-acceso-cliente.bat` como administrador.
5. Abrir `https://contaduria.local:3000` (el mismo icono de la PWA).

No hace falta volver a instalar `rootCA.pem`.

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

4. Comprobar `https://contaduria.local:3000` desde otra PC.

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
- [ ] `https://contaduria.local:3000` abre el login **desde otra PC**
- [ ] Certificado CA importado en las PCs de trabajo
- [ ] PWA instalada desde `contaduria.local` (no desde la IP)
- [ ] Contraseña de `admin` cambiada
- [ ] Accesos **Actualizar Contaduría** y **Cambiar red** en el escritorio del servidor
- [ ] Puerto 3000 abierto en el firewall; 5433 cerrado a la red
- [ ] Prueba con 2 PCs a la vez
- [ ] Primera copia de respaldo de la base

---

# Si algo falla

| Problema | Qué revisar |
|----------|-------------|
| “No se pudo conectar al servidor” en las otras PCs | IP, misma WiFi, firewall puerto 3000, PM2 online |
| Login no carga / certificado rojo | Parte C2 (CA) o **Cambiar red** en el servidor y el `.bat` de acceso en esa PC |
| Cambió el WiFi y nadie entra | Parte D2: Cambiar red + kit-clientes en cada puesto |
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
