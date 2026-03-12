# Tren Urquiza — Horarios

Una aplicación web simple y accesible para planificar viajes en el **Tren Urquiza** (Línea Urquiza, Ramal B) en Buenos Aires, Argentina.

🌐 **Sitio:** [trenurquizahorario.ar](https://trenurquizahorario.ar)

---

## Qué hace

- Muestra las próximas salidas según el origen y destino seleccionados
- Usa automáticamente el día y la hora actual al cargar la página
- Muestra tiempos de espera en tiempo real
- Al tocar un resultado, se abre una vista de detalle del viaje con:
  - Un **diagrama de recorrido** con los horarios de llegada en cada parada
  - Una **vista de mapa** interactiva con fondo cartográfico, zoom y desplazamiento libre
- Funciona en celular y computadora
- Accesible — navegable por teclado y compatible con lectores de pantalla

## Datos

Los horarios están basados en el **Horario Mural Invierno 2026** publicado por [Metrovías](https://www.metrovias.com.ar), vigente desde el 2 de marzo de 2026.

Este es un proyecto independiente y no oficial, no afiliado a Metrovías ni al Gobierno de la Provincia de Buenos Aires. Los datos se actualizan manualmente cada temporada cuando Metrovías publica un nuevo Horario Mural.

## Tecnología

- Un solo archivo HTML — sin frameworks, sin dependencias, sin proceso de compilación
- JavaScript vanilla
- Canvas API para el mapa personalizado
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

## Actualizar los horarios

Cuando Metrovías publica un nuevo Horario Mural cada temporada, los datos de los trenes en el archivo `index.html` deben actualizarse. Las variables relevantes son:

- `DL` — salidas desde General Lemos → Federico Lacroze
- `DLC` — salidas desde Federico Lacroze → General Lemos

Cada una tiene tres claves: `weekday`, `saturday` y `sunday`.

## Contribuciones

¿Encontraste un error o un horario incorrecto? Abrí un issue o mandá un pull request.

## Apoyar el proyecto

Si te resultó útil, podés [invitarme un café ☕](https://cafecito.app/martin-pastor).

## Licencia

MIT

---

Hecho por [Martin Pastor](https://martin-pastor.com) · [GitHub](https://github.com/cogsagainstdamachine)
