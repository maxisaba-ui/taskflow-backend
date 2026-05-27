# Primero instalá las librerías necesarias en la consola: pip install rembg pillow
from rembg import remove
from PIL import Image

# Rutas de tus archivos
input_path = '/home/maxi-ubun/Imágenes/rana.png' # Reemplazá con el nombre de la imagen que subiste
output_path = 'rana_icono.png'

# Abrir la imagen original
input_image = Image.open(input_path)

# Quitar el fondo negro
output_image = remove(input_image)

# Guardar la imagen como PNG transparente
output_image.save(output_path)