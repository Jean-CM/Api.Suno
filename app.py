import streamlit as st
import sqlite3
import requests
import random
import time

# URL de tu API en Render (Cambiar cuando esté Live)
RENDER_API_URL = "https://api-suno-nptk.onrender.com"

# 1. BASE DE DATOS LOCAL (Historial y Catálogo)
def init_db():
    conn = sqlite3.connect("jatune_catalog.db")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS artistas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT UNIQUE,
            fecha_creacion TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS canciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            artista_id INTEGER,
            titulo TEXT,
            genero TEXT,
            audio_url TEXT,
            estado TEXT,
            FOREIGN KEY (artista_id) REFERENCES artistas (id)
        )
    """)
    conn.commit()
    conn.close()

init_db()

# 2. GENERADOR DE NOMBRES ARTÍSTICOS EXCLUSIVOS
def generar_nombre_random():
    prefijos = ["Aether", "Zuki", "Lumo", "Vibe", "Nova", "Drako", "Neon", "Sintax", "Baty", "Yleg"]
    nucleos = ["Pop", "Focus", "Chispero", "Tune", "Moon", "Studio", "Legacy", "Mar", "Sonic", "Beat"]
    sufijos = ["CXT", "vibe", "Project", "Bass", "Mundo", "DK", "Loop"]
    
    while True:
        nombre = f"{random.choice(prefijos)} {random.choice(nucleos)}"
        if random.random() > 0.6:
            nombre += f" {random.choice(sufijos)}"
            
        # Verificar que no exista en nuestra DB
        conn = sqlite3.connect("jatune_catalog.db")
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM artistas WHERE nombre = ?", (nombre,))
        existe = cursor.fetchone()
        conn.close()
        
        if not existe:
            return nombre

# CONFIGURACIÓN DE LA PÁGINA (Layout Estilo Sello Oscuro)
st.set_page_config(page_title="JATune Production", layout="wide", initial_sidebar_state="expanded")

# Inyectar CSS personalizado para estética premium oscura
st.markdown("""
    <style>
    .main { background-color: #0b0f19; color: #e5e7eb; }
    .stButton>button { background: linear-gradient(135deg, #ec4899, #8b5cf6); color: white; border: none; border-radius: 8px; font-weight: bold; }
    </style>
    """, unsafe_style_with_html=True)

st.title("🎵 JATune Production")
st.subheader("Sistema de Generación Masiva y Control de Catálogo")

# PESTAÑAS PRINCIPALES DEL LAYOUT
tab_produccion, tab_catalogo = st.tabs(["🚀 Módulo de Producción", "📁 Catálogo de Artistas"])

with tab_produccion:
    col1, col2 = st.columns([1, 1])
    
    with col1:
        st.header("Configuración de Identidad")
        
        # Lógica de Selección de Artista
        tipo_artista = st.radio(
            "¿Qué tipo de artista deseas asociar?",
            ["Elegir Existente", "Nuevo Personalizado", "Aleatorio Exclusivo (Random)"]
        )
        
        conn = sqlite3.connect("jatune_catalog.db")
        cursor = conn.cursor()
        cursor.execute("SELECT nombre FROM artistas")
        lista_artistas = [row[0] for row in cursor.fetchall()]
        conn.close()
        
        artista_final = ""
        if tipo_artista == "Elegir Existente":
            if lista_artistas:
                artista_final = st.selectbox("Selecciona el artista:", lista_artistas)
            else:
                st.warning("No hay artistas creados. Selecciona otra opción para fundar el primero.")
        elif tipo_artista == "Nuevo Personalizado":
            artista_final = st.text_input("Escribe el nombre del nuevo artista:")
        else:
            if st.button("🎲 Previsualizar Nombre Aleatorio"):
                st.session_state["random_name"] = generar_nombre_random()
            artista_final = st.getenv("random_name", st.session_state.get("random_name", "Presiona el botón para generar"))
            st.info(f"Artista sugerido: **{artista_final}**")

    with col2:
        st.header("Entrada de Contenido Musical")
        metodo_entrada = st.radio("Método de trabajo:", ["Por lote (Parámetros fijos)", "Carga Masiva (Pegar Bloque de Texto)"])
        
        cant_temas = 1
        prompt_batch = ""
        
        if metodo_entrada == "Por lote (Parámetros fijos)":
            cant_temas = st.number_input("Cantidad de canciones a crear:", min_value=1, max_value=20, value=1)
            prompt_batch = st.text_input("Género / Estilo (ej: Dembow Dominicano, Bajo Pesado, 120BPM):")
        else:
            prompt_batch = st.text_area("Pega la lista estructurada de pistas (Una por línea):", height=150, 
                                        placeholder="Track 1: Estilo Dembow\nTrack 2: Estilo Trap")

    st.markdown("---")
    
    # BOTÓN DE EJECUCIÓN MAESTRA
    if st.button("Lanzar Secuencia de Producción Masiva 🪄", use_container_width=True):
        if not artista_final or artista_final == "Presiona el botón para generar":
            st.error("Debes definir un artista válido antes de procesar.")
        else:
            st.loading_placeholder = st.empty()
            with st.spinner(f"Procesando catálogo musical para **{artista_final}**... Esto puede tomar unos minutos."):
                
                # Guardar artista si es nuevo o aleatorio
                conn = sqlite3.connect("jatune_catalog.db")
                cursor = conn.cursor()
                cursor.execute("INSERT OR IGNORE INTO artistas (nombre, fecha_creacion) VALUES (?, ?)", 
                               (artista_final, time.strftime("%Y-%m-%d")))
                cursor.execute("SELECT id FROM artistas WHERE nombre = ?", (artista_final,))
                artista_id = cursor.fetchone()[0]
                
                # Procesar pistas
                pistas_a_crear = []
                if metodo_entrada == "Por lote (Parámetros fijos)":
                    pistas_a_crear = [prompt_batch] * int(cant_temas)
                else:
                    pistas_a_crear = [line.strip() for line in prompt_batch.split("\n") if line.strip()]
                
                for idx, item in enumerate(pistas_a_crear):
                    st.write(f"⏳ Generando pista {idx+1}/{len(pistas_a_crear)}: *{item}*...")
                    
                    # Llamada real a tu API en Render
                    try:
                        payload = {"prompt": item, "make_instrumental": True, "wait_audio": True}
                        res = requests.post(f"{RENDER_API_URL}/api/generate", json=payload, timeout=300)
                        
                        if res.status_code == 200:
                            data = res.json()
                            # Asumiendo que la API devuelve una lista de canciones creadas
                            for track in data.get("tracks", [{"title": f"Track {idx+1}", "audio_url": ""}]):
                                cursor.execute("""
                                    INSERT INTO canciones (artista_id, titulo, genero, audio_url, estado)
                                    VALUES (?, ?, ?, ?, ?)
                                """, (artista_id, track.get("title"), item, track.get("audio_url"), "Listo"))
                            st.success(f"✅ Pista {idx+1} inyectada con éxito.")
                        else:
                            st.error(f"❌ Error en API de Render al procesar pista {idx+1}.")
                    except Exception as e:
                        st.error(f"Se perdió la conexión con el servidor: {e}")
                
                conn.commit()
                conn.close()
                st.balloons()

with tab_catalogo:
    st.header("Inventario de JATune Production")
    
    conn = sqlite3.connect("jatune_catalog.db")
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT a.nombre, COUNT(c.id), a.id 
        FROM artistas a LEFT JOIN canciones c ON a.id = c.artista_id 
        GROUP BY a.id
    """)
    res_artistas = cursor.fetchall()
    
    if res_artistas:
        for name, count, a_id in res_artistas:
            with st.expander(f"👤 {name} — ({count} Temas creados en Sistema)"):
                cursor.execute("SELECT titulo, genero, audio_url, estado FROM canciones WHERE artista_id = ?", (a_id,))
                canciones = cursor.fetchall()
                if canciones:
                    for t_titulo, t_genero, t_url, t_estado in canciones:
                        col_t1, col_t2 = st.columns([2, 1])
                        with col_t1:
                            st.write(f"🎵 **{t_titulo}** — *{t_genero}*")
                            if t_url:
                                st.audio(t_url)
                        with col_t2:
                            st.write(f"Estado: **{t_estado}**")
                else:
                    st.write("Este artista aún no tiene música registrada en el catálogo.")
    else:
        st.info("El catálogo está vacío. Genera tu primer lote en la pestaña anterior.")
    conn.close()
