# Dealer DMS

App de escritorio para un **taller** (órdenes de servicio, clientes, partes, caja). Opcionalmente también vende autos. Todo vive en **una PC**: SQLite local, sin nube.

## Para el taller (cliente)

1. Instala `DealerDMS-Setup.exe` (Windows 10/11, 64 bits).
2. Si SmartScreen avisa, **Más información → Ejecutar de todas formas**. El instalador no está firmado.
3. Abre **Dealer DMS** desde el escritorio.
4. Cambia la contraseña en Inicio (o Ajustes) antes de dejar la PC en el piso.
5. En **Ajustes** pon el nombre del taller, dirección de Calgary, GST 5 % y número GST si lo tienen.

Los datos quedan en:

```
%APPDATA%\DealerDMS\dealer.db
```

Copia de seguridad: cierra la app y copia `dealer.db`, `dealer.db-wal` y `dealer.db-shm`. La app también guarda copias automáticas en `%APPDATA%\DealerDMS\backups\` antes de cada actualización (y con **Respaldar ahora** en Ajustes).

## Actualizaciones

En la app instalada, **Ajustes → Actualizaciones** (solo Admin/Master, y hay que activar la casilla). Antes de instalar se respalda la base; el instalador solo reemplaza el programa, no la carpeta de datos. Quien tenga 1.0.0 debe instalar 1.0.1 o posterior a mano una vez; después las siguientes salen desde la app.

## Qué incluye

- Taller: OT, presupuestos, operaciones, partes, cobro y entrega
- Clientes y vehículos (los del taller; inventario de venta es opcional)
- Agenda: no cruza al mismo técnico ni al mismo cliente, y una cita sin técnico ocupa toda la línea
- Horario del taller: días hábiles y hora de apertura y cierre (por ejemplo 06:00 a 21:00)
- Feriados: los de Alberta salen solos; se puede agregar uno, cambiar la fecha o el nombre, quitarlo, o dejar ese día abierto
- Citas de la página web: se ven como web. Si el cliente es nuevo, se da de alta con su auto. Si no trae VIN, queda uno temporal hasta que el auto llegue; año, marca y modelo son obligatorios
- Inicio configurable y temas
- Español / English / Français (CAD, GST Alberta)
- Usuarios: Admin, Master, Gerente, Empleado
- Una PC por taller (no hay servidor de red en esta versión)

## Generar el instalador (desarrollo)

Node.js 20+ en Windows. Desde la carpeta del proyecto:

```powershell
npm install --ignore-scripts
npm run rebuild
npm run dist
```

El instalador queda en `release\DealerDMS-Setup.exe`. Esa es la copia que se manda al cliente.

`--ignore-scripts` + `npm run rebuild` instala SQLite para Electron (no hace falta Visual Studio).
