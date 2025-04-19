// script.js

document.getElementById('survey-form').addEventListener('submit', async function(event) {
    event.preventDefault(); // Previene el envío normal del formulario

    const submitButton = document.getElementById('submit');
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Enviando...';

    // --- INICIO: Validaciones Cliente ---

    //Validaciones para name
    const nameInput = document.getElementById('name');
    const nameValue = nameInput.value.trim();
    const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]+$/;

    if (nameValue.length === 0) {
        alert('Por favor, introduce tu nombre.');
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
        nameInput.focus(); // Poner foco en el campo
        return;
    }
    if (nameValue.length > 100) {
        alert('El nombre no puede exceder los 100 caracteres.');
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
        nameInput.focus();
        return;
    }
    if (!nameRegex.test(nameValue)) {
        alert('El nombre contiene caracteres no válidos.');
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
        nameInput.focus();
        return;
    }

    // Validaciones para email
    const emailInput = document.getElementById('email');
    const emailValue = emailInput.value.trim();
    // Regex similar al backend para consistencia (puede ser ligeramente menos estricto si se desea)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (emailValue.length === 0) {
        alert('Por favor, introduce tu correo electrónico.');
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
        emailInput.focus();
        return;
    }
    if (emailValue.length > 254) { // Mismo límite que el backend
        alert('El correo electrónico no puede exceder los 254 caracteres.');
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
        emailInput.focus();
        return;
    }
    if (!emailRegex.test(emailValue)) {
        alert('Por favor, introduce un formato de correo electrónico válido (ej. usuario@dominio.com).');
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
        emailInput.focus();
        return;
    }

    // (Opcional) Añadir validaciones para otros campos requeridos si es necesario
    const roleSelect = document.getElementById('dropdown');
    if (!roleSelect.value) {
        alert('Por favor, selecciona tu criptomoneda favorita.');
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
        roleSelect.focus();
        return;
    }

    // --- FIN: Validaciones Cliente ---


    // 1. Recolectar datos del formulario
    const formData = new FormData(this);
    const data = {};

    formData.forEach((value, key) => {
        if (key === 'prefer') {
            if (!data[key]) { data[key] = []; }
            data[key].push(value);
        } else {
            // Asegurarse de hacer trim a los valores de texto relevantes aquí también
            // aunque el backend lo haga, mejora la consistencia
            data[key] = typeof value === 'string' ? value.trim() : value;
        }
    });

    // Asegurarse de que los campos opcionales que no se llenaron sean null
    // Hacer trim aquí también si no se hizo en el bucle
    data.name = data.name.trim(); // Ya validado y trimeado antes
    data.email = data.email.trim(); // Ya validado y trimeado antes
    data.age = data.age || null;
    data.comment = data.comment ? data.comment.trim() : null; // Trim si existe
    data.frequency = data.frequency || null;
    data.prefer = data.prefer || [];

    try {
        // 2. Enviar datos a la Cloudflare Function en /submit
        const response = await fetch('/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(data),
        });

        // 3. Procesar la respuesta de la función
        if (response.ok) {
            const result = await response.json();
            console.log('Success:', result);
            alert('¡Gracias por tu respuesta! Encuesta enviada correctamente.');
            this.reset(); // Limpiar el formulario
        } else {
            let errorMsg = `Error: ${response.status} ${response.statusText}`;
            try {
                const errorResult = await response.json();
                 // Usar el mensaje de error específico del backend si está disponible
                errorMsg = errorResult.error || errorMsg + `\nDetalles: ${JSON.stringify(errorResult)}`;
            } catch (e) {
                const textError = await response.text();
                errorMsg += `\nRespuesta: ${textError}`;
            }
            console.error('Error details:', errorMsg);
            // Mostrar el mensaje de error del backend al usuario
            alert(`Hubo un error al enviar la encuesta:\n${errorMsg}\n\nPor favor, revisa los datos e inténtalo de nuevo.`);
        }
    } catch (error) {
        console.error('Fetch Error:', error);
        alert('Hubo un error de conexión al enviar la encuesta. Por favor, revisa tu conexión e inténtalo de nuevo.');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
});