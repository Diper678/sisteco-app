"""
notebooklm-bridge.py
====================
Puente entre Obsidian (Sisteco) y NotebookLM.
Adaptado del bridge original de Ingenieria Civil Bioquimica.

Funciones principales:
  1. Login a NotebookLM (via CLI de notebooklm-py)
  2. Subir notas de Obsidian como fuentes a NotebookLM
  3. Generar quiz, flashcards, podcast, reportes desde documentos
  4. Extraer conceptos clave y crear MOC en Obsidian
  5. Chat con documentos de la empresa

Requisitos:
  pip install "notebooklm-py[browser]" python-frontmatter
  playwright install chromium

Uso rapido:
  python scripts/notebooklm-bridge.py check
  python scripts/notebooklm-bridge.py sync
  python scripts/notebooklm-bridge.py sync --folder "procesos"
  python scripts/notebooklm-bridge.py study
  python scripts/notebooklm-bridge.py ask "Como funciona el pipeline de leads?"
"""

import asyncio
import subprocess
import sys
import re
from pathlib import Path
from collections import Counter

# ============================================================
# CONFIGURACION — SISTECO
# ============================================================

# Vault de Obsidian de Sisteco
DEFAULT_VAULT_PATH = r"C:\Users\Dell 5520\Documents\Obsidian de Sisteco\Sisteco"

# Nombre base para notebooks en NotebookLM
NOTEBOOK_PREFIX = "Sisteco"

# Mapeo de carpetas Obsidian -> notebooks NotebookLM
FOLDER_NOTEBOOK_MAP = {
    "procesos":       "Sisteco - Procesos",
    "integraciones":  "Sisteco - Integraciones",
    "Tech":           "Sisteco - Tech",
    "agentes":        "Sisteco - Agentes",
    "Sisteco":        "Sisteco - Estrategia",
    "Logs":           "Sisteco - Logs",
}

# Notebook por defecto (sync completo)
DEFAULT_NOTEBOOK_NAME = "Sisteco - Base de Conocimiento"

# Carpetas de Obsidian a excluir
EXCLUDE_DIRS = ['.obsidian', '.trash', '.git', 'Templates', 'attachments']

# Limites de NotebookLM
MAX_SOURCES = 50
MAX_CHARS_PER_SOURCE = 490_000


# ============================================================
# PARTE 1: LOGIN Y VERIFICACION
# ============================================================

def _find_notebooklm_exe() -> str:
    """Encontrar el ejecutable notebooklm en el sistema."""
    candidates = [
        Path.home() / "AppData" / "Roaming" / "Python"
        / f"Python{sys.version_info.major}{sys.version_info.minor}"
        / "Scripts" / "notebooklm.exe",
        Path(sys.executable).parent / "Scripts" / "notebooklm.exe",
        Path(sys.executable).parent / "notebooklm.exe",
    ]
    for p in candidates:
        if p.exists():
            return str(p)
    return None


def login():
    """Login a NotebookLM. Abre Chromium para auth Google. Solo primera vez."""
    # Intentar primero con script custom (mas robusto en Windows)
    custom_login = Path(__file__).parent / "notebooklm-login.py"
    if custom_login.exists():
        subprocess.run([sys.executable, str(custom_login)])
        return

    exe = _find_notebooklm_exe()
    if not exe:
        print("ERROR: No se encontro 'notebooklm' CLI.")
        print("Instala: pip install \"notebooklm-py[browser]\"")
        print("Luego: playwright install chromium")
        return

    print("Ejecutando login via notebooklm CLI...")
    print(f"Usando: {exe}")
    print("Se abrira un navegador. Inicia sesion con Google.\n")

    try:
        result = subprocess.run([exe, "login"], timeout=300)
        if result.returncode == 0:
            print("\nLogin completado.")
        else:
            print(f"\nLogin termino con codigo: {result.returncode}")
    except subprocess.TimeoutExpired:
        print("\nTimeout: login tardo mas de 5 minutos.")
    except FileNotFoundError as e:
        print(f"Error: {e}")


async def check_auth():
    """Verificar si la autenticacion esta activa."""
    from notebooklm import NotebookLMClient

    try:
        async with await NotebookLMClient.from_storage() as client:
            nbs = await client.notebooks.list()
            print(f"Auth OK. {len(nbs)} notebooks:")
            for nb in nbs[:15]:
                print(f"  - {nb.title} (id: {nb.id[:12]}...)")
            return True
    except FileNotFoundError:
        print("No hay credenciales. Ejecuta: python scripts/notebooklm-bridge.py login")
        return False
    except Exception as e:
        print(f"Error auth: {e}")
        print("Ejecuta: python scripts/notebooklm-bridge.py login")
        return False


# ============================================================
# PARTE 2: PARSEO DE OBSIDIAN
# ============================================================

def parse_note(filepath: Path) -> dict:
    """Parsear una nota .md de Obsidian."""
    try:
        import frontmatter
    except ImportError:
        # Fallback sin frontmatter
        text = filepath.read_text(encoding='utf-8')
        return {
            'filepath': filepath,
            'metadata': {},
            'content': text,
            'tags': [],
            'wikilinks': [],
            'headers': [],
        }

    with open(filepath, 'r', encoding='utf-8') as f:
        post = frontmatter.load(f)

    content = post.content
    metadata = dict(post.metadata)

    # Tags
    fm_tags = metadata.get('tags', [])
    if isinstance(fm_tags, str):
        fm_tags = [fm_tags]
    inline_tags = re.findall(
        r'(?:^|\s)#([a-zA-Z\u00C0-\u024F][a-zA-Z0-9\u00C0-\u024F_/\-]*)',
        content
    )
    tags = list(set(fm_tags + inline_tags))

    # Wikilinks
    wikilinks = []
    for link in re.findall(r'(?<!!)\[\[([^\]]+)\]\]', content):
        name = link.split('|')[0].split('#')[0].strip()
        if name:
            wikilinks.append(name)

    # Headers
    headers = []
    for m in re.finditer(r'^(#{1,6})\s+(.+)$', content, re.MULTILINE):
        headers.append({'level': len(m.group(1)), 'text': m.group(2).strip()})

    return {
        'filepath': filepath,
        'metadata': metadata,
        'content': content,
        'tags': tags,
        'wikilinks': wikilinks,
        'headers': headers,
    }


def clean_note_for_notebooklm(note: dict) -> str:
    """Convertir nota Obsidian a texto limpio para NotebookLM."""
    title = note['metadata'].get('title', '')
    if not title and note['headers']:
        title = note['headers'][0]['text']
    if not title:
        title = note['filepath'].stem

    lines = [f"# {title}", ""]

    if note['tags']:
        lines.append(f"**Tags:** {', '.join(note['tags'])}")
        lines.append("")

    content = note['content']
    content = re.sub(r'\[\[([^\]|]+)\|([^\]]+)\]\]', r'\2', content)
    content = re.sub(r'\[\[([^\]]+)\]\]', r'\1', content)
    content = re.sub(r'!\[\[([^\]]+)\]\]', r'[Archivo adjunto: \1]', content)

    lines.append(content)
    return '\n'.join(lines)


def scan_vault(vault_path: str, folders: list = None, tags_filter: list = None) -> list:
    """Escanear vault y retornar notas parseadas."""
    vault = Path(vault_path)
    notes = []

    for md_file in vault.rglob('*.md'):
        rel_path = md_file.relative_to(vault)
        if any(part in EXCLUDE_DIRS for part in rel_path.parts):
            continue

        try:
            parsed = parse_note(md_file)
            parsed['relative_path'] = str(rel_path)
            parsed['folder'] = str(rel_path.parent) if rel_path.parent != Path('.') else 'root'
            notes.append(parsed)
        except Exception as e:
            print(f"  Error parseando {rel_path}: {e}")

    if folders:
        notes = [n for n in notes
                 if n['folder'] in folders
                 or any(n['folder'].startswith(f) for f in folders)]

    if tags_filter:
        notes = [n for n in notes
                 if any(t in n['tags'] for t in tags_filter)]

    return notes


# ============================================================
# PARTE 3: SINCRONIZACION OBSIDIAN -> NOTEBOOKLM
# ============================================================

async def sync_to_notebooklm(
    vault_path: str,
    notebook_name: str = None,
    folders: list = None,
    tags_filter: list = None,
    mode: str = "by_folder"
):
    """
    Sincronizar notas de Obsidian a NotebookLM.

    Modos:
      - "individual": cada nota como fuente separada (max 50)
      - "by_folder": notas agrupadas por carpeta (default)
      - "by_tag": notas agrupadas por tag principal
    """
    from notebooklm import NotebookLMClient

    notebook_name = notebook_name or DEFAULT_NOTEBOOK_NAME

    # 1. Escanear vault
    print(f"\nEscaneando vault: {vault_path}")
    notes = scan_vault(vault_path, folders, tags_filter)
    print(f"  Notas encontradas: {len(notes)}")

    if not notes:
        print("No se encontraron notas. Verifica la ruta y filtros.")
        return

    # 2. Preparar contenido
    sources_to_add = []

    if mode == "individual":
        for note in notes[:MAX_SOURCES]:
            text = clean_note_for_notebooklm(note)
            title = note['metadata'].get('title', note['filepath'].stem)
            sources_to_add.append((title, text[:MAX_CHARS_PER_SOURCE]))

    elif mode == "by_folder":
        folder_groups = {}
        for note in notes:
            folder_groups.setdefault(note['folder'], []).append(note)

        for folder, folder_notes in folder_groups.items():
            # Usar nombre de notebook mapeado si existe
            nb_name = FOLDER_NOTEBOOK_MAP.get(folder, None)
            parts = [f"# Carpeta: {folder}\n"]
            for note in folder_notes:
                parts.append(clean_note_for_notebooklm(note))
                parts.append("\n---\n")
            text = '\n'.join(parts)
            sources_to_add.append((f"[{folder}]", text[:MAX_CHARS_PER_SOURCE]))

    elif mode == "by_tag":
        tag_groups = {}
        for note in notes:
            primary_tag = note['tags'][0] if note['tags'] else 'sin-tag'
            tag_groups.setdefault(primary_tag, []).append(note)

        for tag, tag_notes in tag_groups.items():
            parts = [f"# Tag: #{tag}\n"]
            for note in tag_notes:
                parts.append(clean_note_for_notebooklm(note))
                parts.append("\n---\n")
            text = '\n'.join(parts)
            sources_to_add.append((f"#{tag}", text[:MAX_CHARS_PER_SOURCE]))

    if len(sources_to_add) > MAX_SOURCES:
        print(f"  Advertencia: {len(sources_to_add)} fuentes > max {MAX_SOURCES}. Truncando.")
        sources_to_add = sources_to_add[:MAX_SOURCES]

    # 3. Conectar a NotebookLM
    print(f"\nConectando a NotebookLM...")
    async with await NotebookLMClient.from_storage() as client:

        # Buscar o crear notebook
        notebooks = await client.notebooks.list()
        notebook = None
        for nb in notebooks:
            if nb.title == notebook_name:
                notebook = nb
                break

        if notebook:
            print(f"  Notebook existente: {notebook.title}")
        else:
            notebook = await client.notebooks.create(notebook_name)
            print(f"  Notebook creado: {notebook.title}")

        # 4. Subir fuentes
        print(f"\nSubiendo {len(sources_to_add)} fuentes...")
        for i, (title, content) in enumerate(sources_to_add, 1):
            try:
                await client.sources.add_text(
                    notebook.id,
                    title=title,
                    content=content,
                    wait=True,
                    wait_timeout=120.0,
                )
                print(f"  [{i}/{len(sources_to_add)}] OK: {title}")
            except Exception as e:
                print(f"  [{i}/{len(sources_to_add)}] ERROR: {title}: {e}")

        sources = await client.sources.list(notebook.id)
        print(f"\nSync completado. Notebook: {notebook.title} ({len(sources)} fuentes)")
        print(f"  https://notebooklm.google.com")


# ============================================================
# PARTE 4: GENERAR MATERIALES
# ============================================================

async def generate_study_materials(notebook_name: str = None, output_dir: str = None):
    """Generar quiz, flashcards, guia de estudio, podcast."""
    from notebooklm import NotebookLMClient

    notebook_name = notebook_name or DEFAULT_NOTEBOOK_NAME
    output = Path(output_dir) if output_dir else Path("./notebooklm_output")
    output.mkdir(parents=True, exist_ok=True)

    async with await NotebookLMClient.from_storage() as client:
        notebooks = await client.notebooks.list()
        notebook = None
        for nb in notebooks:
            if nb.title == notebook_name:
                notebook = nb
                break

        if not notebook:
            print(f"Notebook '{notebook_name}' no encontrado.")
            print("Disponibles:")
            for nb in notebooks:
                print(f"  - {nb.title}")
            return

        print(f"Generando desde: {notebook.title}")
        nb_id = notebook.id

        # Quiz
        try:
            print("\n  [1/4] Quiz...")
            status = await client.artifacts.generate_quiz(nb_id)
            if status.task_id:
                await client.artifacts.wait_for_completion(nb_id, status.task_id, timeout=120.0)
            path = await client.artifacts.download_quiz(nb_id, str(output / "quiz.json"))
            print(f"    OK: {path}")
        except Exception as e:
            print(f"    Error: {e}")

        # Flashcards
        try:
            print("  [2/4] Flashcards...")
            status = await client.artifacts.generate_flashcards(nb_id)
            if status.task_id:
                await client.artifacts.wait_for_completion(nb_id, status.task_id, timeout=120.0)
            path = await client.artifacts.download_flashcards(nb_id, str(output / "flashcards.json"))
            print(f"    OK: {path}")
        except Exception as e:
            print(f"    Error: {e}")

        # Study Guide
        try:
            print("  [3/4] Guia de estudio...")
            status = await client.artifacts.generate_study_guide(nb_id, language="es")
            if status.task_id:
                await client.artifacts.wait_for_completion(nb_id, status.task_id, timeout=180.0)
            path = await client.artifacts.download_report(nb_id, str(output / "guia_estudio.md"))
            print(f"    OK: {path}")
        except Exception as e:
            print(f"    Error: {e}")

        # Audio podcast
        try:
            print("  [4/4] Podcast (2-5 min)...")
            status = await client.artifacts.generate_audio(nb_id, language="es")
            if status.task_id:
                await client.artifacts.wait_for_completion(nb_id, status.task_id, timeout=600.0)
            path = await client.artifacts.download_audio(nb_id, str(output / "podcast.mp3"))
            print(f"    OK: {path}")
        except Exception as e:
            print(f"    Error: {e}")

        print(f"\nMateriales en: {output.resolve()}")


# ============================================================
# PARTE 5: CONCEPTOS -> MOC
# ============================================================

def generate_obsidian_moc(vault_path: str, output_name: str = "MOC Auto-generado.md"):
    """Crear nota MOC (Map of Content) con conceptos clave del vault."""
    notes = scan_vault(vault_path)
    print(f"Analizando {len(notes)} notas...")

    wikilink_counts = Counter()
    tag_counts = Counter()
    header_counts = Counter()
    bold_counts = Counter()

    for note in notes:
        wikilink_counts.update(note['wikilinks'])
        tag_counts.update(note['tags'])
        for h in note['headers']:
            text = re.sub(r'[*_`\[\]]', '', h['text']).strip()
            if len(text) > 2:
                header_counts[text] += 1
        for term in re.findall(r'\*\*([^*]+)\*\*', note['content']):
            term = term.strip()
            if 2 < len(term) < 100:
                bold_counts[term] += 1

    # PageRank
    hub_notes = []
    try:
        from obsidiantools.api import Vault
        import networkx as nx
        v = Vault(Path(vault_path)).connect()
        if v.graph.number_of_nodes() > 0:
            pr = nx.pagerank(v.graph)
            hub_notes = sorted(pr.items(), key=lambda x: x[1], reverse=True)[:15]
    except Exception:
        pass

    from datetime import date
    lines = [
        "---",
        f"title: {output_name.replace('.md', '')}",
        f"date: {date.today()}",
        "tags: [MOC, indice, auto-generado, sisteco]",
        "---", "",
        "# Mapa de Conceptos — Sisteco", "",
        f"> {len(notes)} notas analizadas. Generado: {date.today()}", "",
    ]

    if wikilink_counts:
        lines.extend(["## Conceptos Mas Enlazados", ""])
        for concept, count in wikilink_counts.most_common(25):
            lines.append(f"- [[{concept}]] ({count} enlaces)")
        lines.append("")

    if hub_notes:
        lines.extend(["## Notas Hub", ""])
        for name, score in hub_notes:
            lines.append(f"- [[{name}]] (importancia: {score:.3f})")
        lines.append("")

    if tag_counts:
        lines.extend(["## Tags Principales", ""])
        for tag, count in tag_counts.most_common(20):
            lines.append(f"- #{tag} ({count} notas)")
        lines.append("")

    if bold_counts:
        lines.extend(["## Terminos Destacados", ""])
        for term, count in bold_counts.most_common(20):
            lines.append(f"- **{term}** ({count}x)")
        lines.append("")

    # Estructura
    folder_groups = {}
    for note in notes:
        folder_groups.setdefault(note['folder'], []).append(note)

    lines.extend(["## Estructura del Vault", ""])
    for folder, folder_notes in sorted(folder_groups.items()):
        lines.append(f"### {folder} ({len(folder_notes)} notas)")
        for note in sorted(folder_notes, key=lambda n: n['filepath'].stem):
            lines.append(f"- [[{note['filepath'].stem}]]")
        lines.append("")

    text = '\n'.join(lines)
    out_path = Path(vault_path) / output_name
    out_path.write_text(text, encoding='utf-8')
    print(f"MOC generado: {out_path}")
    return out_path


# ============================================================
# PARTE 6: CHAT CON DOCUMENTOS
# ============================================================

async def ask_notes(question: str, notebook_name: str = None):
    """Preguntar a los documentos en NotebookLM."""
    from notebooklm import NotebookLMClient

    notebook_name = notebook_name or DEFAULT_NOTEBOOK_NAME

    async with await NotebookLMClient.from_storage() as client:
        notebooks = await client.notebooks.list()
        notebook = None
        for nb in notebooks:
            if nb.title == notebook_name:
                notebook = nb
                break

        if not notebook:
            print(f"Notebook '{notebook_name}' no encontrado.")
            return

        result = await client.chat.ask(notebook.id, question)
        print(f"\nPregunta: {question}")
        print(f"\nRespuesta:\n{result.answer}")

        if hasattr(result, 'references') and result.references:
            print(f"\nFuentes citadas:")
            for ref in result.references:
                print(f"  [{ref.citation_number}] {ref.cited_text[:100]}...")

        return result


# ============================================================
# PARTE 7: LISTAR NOTEBOOKS
# ============================================================

async def list_notebooks():
    """Listar todos los notebooks disponibles."""
    from notebooklm import NotebookLMClient

    async with await NotebookLMClient.from_storage() as client:
        notebooks = await client.notebooks.list()
        print(f"\n{len(notebooks)} notebooks:\n")
        for nb in notebooks:
            sources_count = getattr(nb, 'sources_count', '?')
            print(f"  {nb.title}")
            print(f"    ID: {nb.id}")
            print(f"    Fuentes: {sources_count}")
            print()
        return notebooks


# ============================================================
# CLI
# ============================================================

def main():
    if len(sys.argv) < 2:
        print("""
Uso: python scripts/notebooklm-bridge.py <comando> [args]

Comandos:
  login                          Login con Google (primera vez)
  check                          Verificar autenticacion
  list                           Listar notebooks
  sync [--folder X] [--tag X]    Sync vault Sisteco a NotebookLM
  concepts                       Generar MOC en Obsidian
  study [--notebook X]           Generar quiz, flashcards, guia, podcast
  ask "pregunta"                 Preguntar a tus documentos

Ejemplos:
  python scripts/notebooklm-bridge.py check
  python scripts/notebooklm-bridge.py sync
  python scripts/notebooklm-bridge.py sync --folder "procesos"
  python scripts/notebooklm-bridge.py sync --folder "Tech"
  python scripts/notebooklm-bridge.py study --notebook "Sisteco - Procesos"
  python scripts/notebooklm-bridge.py ask "Como funciona el scoring de leads?"
        """)
        return

    cmd = sys.argv[1]

    if cmd == "login":
        login()

    elif cmd == "check":
        asyncio.run(check_auth())

    elif cmd == "list":
        asyncio.run(list_notebooks())

    elif cmd == "sync":
        vault = DEFAULT_VAULT_PATH
        folders = None
        notebook = None
        tags = None
        mode = "by_folder"

        args = sys.argv[2:]
        i = 0
        while i < len(args):
            if args[i] == "--folder" and i + 1 < len(args):
                folders = [args[i + 1]]
                i += 2
            elif args[i] == "--notebook" and i + 1 < len(args):
                notebook = args[i + 1]
                i += 2
            elif args[i] == "--tag" and i + 1 < len(args):
                tags = [args[i + 1]]
                i += 2
            elif args[i] == "--mode" and i + 1 < len(args):
                mode = args[i + 1]
                i += 2
            elif args[i] == "--vault" and i + 1 < len(args):
                vault = args[i + 1]
                i += 2
            else:
                i += 1

        asyncio.run(sync_to_notebooklm(
            vault, notebook_name=notebook, folders=folders,
            tags_filter=tags, mode=mode
        ))

    elif cmd == "concepts":
        vault = DEFAULT_VAULT_PATH
        args = sys.argv[2:]
        if args and args[0] == "--vault" and len(args) > 1:
            vault = args[1]
        generate_obsidian_moc(vault)

    elif cmd == "study":
        notebook = None
        output = None
        args = sys.argv[2:]
        i = 0
        while i < len(args):
            if args[i] == "--notebook" and i + 1 < len(args):
                notebook = args[i + 1]
                i += 2
            elif args[i] == "--output" and i + 1 < len(args):
                output = args[i + 1]
                i += 2
            else:
                i += 1
        asyncio.run(generate_study_materials(notebook, output))

    elif cmd == "ask":
        question = sys.argv[2] if len(sys.argv) > 2 else "Resume los temas principales"
        asyncio.run(ask_notes(question))

    else:
        print(f"Comando desconocido: {cmd}")
        print("Usa: python scripts/notebooklm-bridge.py (sin args) para ver ayuda.")


if __name__ == "__main__":
    main()
