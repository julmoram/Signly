# Signly

App web para reconocimiento de lenguaje de senas con:
- Frontend: React + Vite
- Backend: FastAPI
- Modelo: LSTM (`action.h5`)

Tambien incluye una pestana **Ensenar** para guardar muestras desde la camara directo en `datasets/manual/`.

## 1) Requisitos

- Windows + PowerShell
- Python 3.12 instalado (`py -3.12`)
- Node.js (para frontend)

## 2) Levantar la app

Desde la raiz del proyecto:

```powershell
cd C:\Users\elias\OneDrive\Documentos\Integrador\Signly
.\start-signly.ps1
```

Eso abre:
- Backend: `http://127.0.0.1:8000`
- Frontend: `http://localhost:5173`

Si necesitas instalar dependencias:

```powershell
.\start-signly.ps1 -InstallDeps
```

## 3) Ensenar palabras desde la app

1. Abre la pestana **Ensenar**.
2. Escribe la palabra (ejemplo: `como` o `estas`).
3. Usa `Capturar 1` o `Iniciar lote`.
4. Se guardan imagenes en:

```text
datasets/manual/<palabra_normalizada>/*.jpg
```

Ejemplo:

```text
datasets/manual/como_estas/20260426_220000_123456.jpg
```

## 4) Entrenar el LSTM con tus lotes

Ejecuta:

```powershell
& .\.venv-lstm\Scripts\python.exe .\scripts\train_from_manual.py
```

Por defecto el script:
- Lee `datasets/manual/`
- Usa secuencias de 30 frames
- Entrena LSTM
- Guarda modelo en `external/ActionDetectionforSignLanguage/action.h5`
- Guarda etiquetas en `external/ActionDetectionforSignLanguage/action_labels.json`

### Opciones utiles

```powershell
& .\.venv-lstm\Scripts\python.exe .\scripts\train_from_manual.py `
  --sequence-length 30 `
  --epochs 60 `
  --batch-size 16 `
  --train-ratio 0.8 `
  --min-sequences-per-label 2
```

## 5) Reiniciar y probar

Despues de entrenar:

1. Deten backend/frontend si estan corriendo.
2. Ejecuta de nuevo:

```powershell
.\start-signly.ps1
```

3. Ve a la pestana `Traducir` y prueba tus nuevas palabras.

## 6) Como decide que palabras reconoce

El backend carga:

1. Modelo:
   - `external/ActionDetectionforSignLanguage/action.h5`
2. Etiquetas:
   - `external/ActionDetectionforSignLanguage/action_labels.json`

Si no existe `action_labels.json`, usa etiquetas por defecto en:
- `model/predict.py` (`DEFAULT_ACTIONS`)

## 7) Endpoints backend

- `POST /predict`: recibe frame y devuelve prediccion
- `POST /teach`: guarda frame etiquetado en dataset manual
- `POST /tts`: audio de salida

## 8) Notas practicas para mejor entrenamiento

- Mantener iluminacion estable.
- Mantener mano/cuerpo centrados.
- Grabar cada palabra desde varios angulos.
- Evitar mezclar dos palabras distintas en el mismo lote.
- Balancear cantidad de muestras por etiqueta.
