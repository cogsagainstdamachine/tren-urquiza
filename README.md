# Tren Urquiza — Horarios

Una aplicación web simple y accesible para planificar viajes en el **Tren Urquiza** (Línea Urquiza, Ramal B) en Buenos Aires, Argentina.

🌐 **Sitio:** [trenurquizahorario.ar](https://trenurquizahorario.ar)

---

## Qué hace

- Muestra las próximas salidas según el origen y destino seleccionados
- Usa automáticamente el día y la hora actual al cargar la página
- Detecta feriados nacionales y aplica el horario correspondiente automáticamente
- Muestra tiempos de espera en tiempo real
- Al tocar un resultado, se abre una vista de detalle del viaje con un diagrama de recorrido con los horarios de llegada en cada parada
- Funciona en celular y computadora
- Accesible — navegable por teclado y compatible con lectores de pantalla

## Datos

Los horarios están basados en el **[Horario Mural Invierno 2026](https://metrovias.com.ar/wp-content/uploads/2026/02/Horarios-Mural_-invierno-2026-curvas.pdf)** publicado por [Metrovías](https://www.metrovias.com.ar), vigente desde el 2 de marzo de 2026.

Este es un proyecto independiente y no oficial, no afiliado a Metrovías ni al Gobierno de la Provincia de Buenos Aires.

## Tech

- Un solo archivo HTML — sin frameworks, sin dependencias, sin proceso de compilación
- JavaScript vanilla
- Publicado en GitHub Pages

## Correr localmente

No necesitás ningún proceso de build. Simplemente abrí el archivo:

```bash
open index.html
```

O servilo localmente:

```bash
npx serve .
```

---

## Actualizar los horarios

Cuando Metrovías publica un nuevo Horario Mural cada temporada, los tiempos se actualizan en dos pasos.

### Archivos involucrados

| Archivo | Descripción |
|---|---|
| `tren-urquiza-horarios.xlsx` | Planilla con los horarios. La pestaña **INPUT** es la fuente de datos. |
| `update_schedule.py` | Script que lee la planilla y actualiza `index.html` automáticamente. |
| `index.html` | El sitio. Sus arrays `DL` y `DLC` son reemplazados por el script. |

### Paso 1 — Actualizar la planilla

Abrí `tren-urquiza-horarios.xlsx` y andá a la pestaña **INPUT**.

Esta pestaña tiene 8 secciones, una por cada combinación de dirección y tipo de día:

| Clave | Descripción |
|---|---|
| `DL_weekday` | Salidas desde General Lemos → Lacroze, Lunes a Viernes |
| `DL_saturday` | Salidas desde General Lemos → Lacroze, Sábados |
| `DL_sunday` | Salidas desde General Lemos → Lacroze, Domingos |
| `DL_holiday` | Salidas desde General Lemos → Lacroze, Feriados |
| `DLC_weekday` | Salidas desde Federico Lacroze → Lemos, Lunes a Viernes |
| `DLC_saturday` | Salidas desde Federico Lacroze → Lemos, Sábados |
| `DLC_sunday` | Salidas desde Federico Lacroze → Lemos, Domingos |
| `DLC_holiday` | Salidas desde Federico Lacroze → Lemos, Feriados |

Editá los horarios en la columna **C** de cada sección. El formato debe ser `HH:MM` (ej: `06:30`). No uses fórmulas en esta columna — solo texto plano.

> ⚠️ **Importante:** al editar una celda en Excel y escribir una hora, Excel puede formatearla automáticamente como valor de tiempo. Esto está contemplado en el script y no genera problemas.

### Paso 2 — Correr el script localmente (opcional)

Si querés verificar los cambios antes de pushear:

```bash
pip install openpyxl   # solo la primera vez
python update_schedule.py --dry-run
```

Para aplicar los cambios a `index.html`:

```bash
python update_schedule.py
```

### Paso 3 — Pushear a GitHub

```bash
git add index.html tren-urquiza-horarios.xlsx
git commit -m "Actualizar horarios - Verano 2027"
git push
```

Al hacer push del xlsx, **GitHub Actions** corre el script automáticamente y actualiza `index.html`. No es necesario correr el script localmente si no querés verificar antes.

### Actualizar los tiempos entre estaciones

Si los tiempos de viaje entre estaciones cambian (no solo los horarios de salida), hay que actualizar manualmente los arrays `TM_LM` y `TM_LC` en `index.html`:

- **`TM_LM`** — tiempos acumulados desde General Lemos hacia Lacroze (23 valores, índice 0 = Lemos)
- **`TM_LC`** — tiempos acumulados desde Federico Lacroze hacia Lemos (23 valores, índice 0 = Lemos)

### Actualizar los feriados

Los feriados nacionales están hardcodeados en `index.html` en el objeto `HOLIDAYS_2026`. Al cambiar de año, actualizar ese set con las fechas del nuevo año.

---

## Contribuciones

¿Encontraste un error o un horario incorrecto? Abrí un issue o mandá un pull request.

## Apoyar el proyecto

Si te resultó útil, podés [invitarme un café ☕](https://cafecito.app/martin-pastor).

## Licencia

MIT

---

Hecho por [Martin Pastor](https://martin-pastor.com) · [GitHub](https://github.com/cogsagainstdamachine)
