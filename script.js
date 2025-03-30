// script.js

document.getElementById('survey-form').addEventListener('submit', async function(event) {
    event.preventDefault(); // Previene el envío normal del formulario

    const submitButton = document.getElementById('submit');
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Enviando...';

    // 1. Recolectar datos del formulario
    const formData = new FormData(this);
    const data = {};

    // Convertir FormData a un objeto simple
    formData.forEach((value, key) => {
        // Manejo especial para checkboxes (pueden tener múltiples valores)
        if (key === 'prefer') {
            if (!data[key]) {
                data[key] = [];
            }
            data[key].push(value);
        } else {
            data[key] = value;
        }
    });

    // Asegurarse de que los campos opcionales que no se llenaron sean null o undefined
    data.age = data.age || null; // Si la edad está vacía, envíala como null
    data.comment = data.comment || null;
    data.frequency = data.frequency || null; // Si no se selecciona radio
    data.prefer = data.prefer || []; // Si no se selecciona checkbox

    try {
        // 2. Enviar datos a la Cloudflare Function en /submit
        const response = await fetch('/submit', { // La ruta '/submit' apunta a functions/submit.js
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        // 3. Procesar la respuesta de la función
        if (response.ok) {
            const result = await response.json();
            console.log('Success:', result);
            alert('¡Gracias por tu respuesta! Encuesta enviada correctamente.');
            this.reset(); // Limpiar el formulario
        } else {
            // Intentar obtener más detalles del error si es posible
            let errorMsg = `Error: ${response.status} ${response.statusText}`;
            try {
                const errorResult = await response.json();
                errorMsg += `\nDetalles: ${errorResult.error || JSON.stringify(errorResult)}`;
            } catch (e) {
                // No se pudo parsear el JSON de error, usar el texto plano
                const textError = await response.text();
                errorMsg += `\nRespuesta: ${textError}`;
            }
            console.error('Error details:', errorMsg);
            alert(`Hubo un error al enviar la encuesta:\n${errorMsg}\n\nPor favor, inténtalo de nuevo.`);
        }
    } catch (error) {
        console.error('Fetch Error:', error);
        alert('Hubo un error de conexión al enviar la encuesta. Por favor, revisa tu conexión e inténtalo de nuevo.');
    } finally {
        // Restaurar el botón
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
});