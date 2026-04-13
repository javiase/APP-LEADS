# Lead Flow Control

Aplicacion para gestionar leads fuera de Notion, con frontend en `HTML/CSS/JS`, backend en `Python + Flask` y base de datos `SQLite`.

## Incluye

- Dashboard con tiempo medio por estado
- Analisis de fuga por leads perdidos o estancados
- Comparativa de efectividad por plantilla A/B
- Gestion y edicion de leads desde la propia app
- Historial completo por lead
- Base de datos local lista para usar
- Datos de ejemplo para ver la app funcionando al arrancar

## Estructura

- `run.py`: punto de entrada
- `server/`: backend y logica
- `static/`: frontend
- `data/leads.db`: base de datos creada automaticamente

## Puesta en marcha

1. Crear entorno virtual:

```powershell
python -m venv .venv
```

2. Activarlo:

```powershell
.venv\Scripts\Activate.ps1
```

3. Instalar dependencias:

```powershell
pip install -r requirements.txt
```

4. Arrancar la app:

```powershell
python run.py
```

5. Abrir:

```text
http://127.0.0.1:5000
```

## Ideas siguientes

- importar CSV desde Notion
- automatizar avisos de acciones vencidas
- conectar canales como Instagram, WhatsApp o email
- anadir login y filtros por comercial o mentor
