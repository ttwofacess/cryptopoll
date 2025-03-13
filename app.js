document.getElementById('survey-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        age: document.getElementById('number').value || null,
        favorite_crypto: document.getElementById('dropdown').value,
        investment_frequency: document.querySelector('input[name="frequency"]:checked').value,
        preferences: Array.from(document.querySelectorAll('input[name="prefer"]:checked')).map(cb => cb.value),
        comments: document.getElementById('comments').value || null
    };

    try {
        const response = await fetch('https://cryptopoll.pages.dev/api/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (result.success) {
            alert('¡Gracias por completar la encuesta!');
            document.getElementById('survey-form').reset();
        } else {
            throw new Error(result.error || 'Error al enviar los datos');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Hubo un error al enviar la encuesta. Por favor, intenta de nuevo.');
    }
});