// functions/submit.js
import { createClient } from "@libsql/client";

// --- START: Email Validation Function ---
function isValidEmail(email) {
    if (!email || typeof email !== 'string') {
        return false;
    }
    const trimmedEmail = email.trim();
    // 1. No vacío después de quitar espacios
    if (trimmedEmail.length === 0) {
        return false;
    }
    // 2. Longitud razonable (ej. máximo 254 caracteres - estándar común)
    if (trimmedEmail.length > 254) {
        return false;
    }
    // 3. Formato básico de email usando Regex.
    //    Este regex es común pero no cubre el 100% de casos RFC (que son muy complejos).
    //    Es un buen balance entre precisión y practicidad.
    //    Permite: a-z A-Z 0-9 . _ % + - antes del @
    //    Permite: a-z A-Z 0-9 . - después del @
    //    Requiere: Al menos un punto en el dominio y al menos 2 letras al final (TLD).
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmedEmail)) {
        console.warn(`Invalid email format detected: ${trimmedEmail}`);
        return false;
    }

    // (Opcional) Podrías añadir chequeos más avanzados si es necesario
    // como verificar si el dominio existe (requiere llamadas externas, más complejo).

    return true; // Pasa todas las validaciones
}
// --- END: Email Validation Function ---


// Función auxiliar para validar el nombre (sin cambios)
function isValidName(name) {
    if (!name || typeof name !== 'string') {
        return false;
    }
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
        return false;
    }
    if (trimmedName.length > 100) {
        return false;
    }
    const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]+$/;
    if (!nameRegex.test(trimmedName)) {
        console.warn(`Invalid characters detected in name: ${trimmedName}`);
        return false;
    }
    return true;
}

// --- START: Age Validation Function (Server-Side) ---
function isValidAge(age) {
    // Age is optional, so null or undefined is valid in terms of presence
    if (age === null || age === undefined) {
        return { isValid: true, value: null }; // Return null to store in DB
    }

    // Manejar explícitamente el caso de booleanos
    if (typeof age === 'boolean') {
        console.warn(`Invalid age type: boolean provided (${age})`);
        return { isValid: false, error: 'La edad debe ser un número entero.' };
    }

    // If present, it must be a number or a string representing an integer
    let parsedAge;
    if (typeof age === 'number') {
        // Verificar si es Infinity o -Infinity
        if (!Number.isFinite(age)) {
            console.warn(`Tipo de edad inválido: se proporcionó un valor infinito (${age})`);
            return { isValid: false, error: 'La edad debe ser un número entero válido.' };
        }
        if (!Number.isInteger(age)) {
            console.warn(`Invalid age type: float number provided (${age})`);
            return { isValid: false, error: 'La edad debe ser un número entero.' };
        }
        parsedAge = age;
    } else if (typeof age === 'string') {
        const trimmedAge = age.trim();
        // Allow empty string as it's optional (will be treated as null)
        if (trimmedAge === '') {
             return { isValid: true, value: null };
        }
        // Check if it's a valid integer representation
        if (!/^\d+$/.test(trimmedAge) || trimmedAge.includes('.')) {
             console.warn(`Invalid age format: non-integer string provided (${trimmedAge})`);
             return { isValid: false, error: 'La edad debe ser un número entero sin decimales.' };
        }
        parsedAge = parseInt(trimmedAge, 10);
        // Double check for potential issues like leading zeros if that matters,
        // but parseInt handles standard integers well.
        if (isNaN(parsedAge)) { // Should not happen with regex check, but safe belt
             console.warn(`Invalid age parsing: string to NaN (${trimmedAge})`);
             return { isValid: false, error: 'Formato de edad inválido.' };
        }

    } else {
        // Not a number, string, null, or undefined - invalid type
        console.warn(`Invalid age type: received type ${typeof age}`);
        return { isValid: false, error: 'Tipo de dato inválido para la edad.' };
    }

    // Check range (define server-side limits)
    const minAge = 10;
    const maxAge = 99;
    if (parsedAge < minAge || parsedAge > maxAge) {
        console.warn(`Invalid age range: ${parsedAge} (must be between ${minAge}-${maxAge})`);
        return { isValid: false, error: `La edad debe estar entre ${minAge} y ${maxAge}.` };
    }

    // If all checks pass
    return { isValid: true, value: parsedAge };
}
// --- END: Age Validation Function (Server-Side) ---


export async function onRequestPost({ request, env }) {
    try {
        const data = await request.json();

        // --- INICIO: Validaciones y Sanitización para 'name' ---
        const sanitizedName = data.name === null ? null :
            (typeof data.name === 'string' ? data.name.trim() : String(data.name).trim());

        if (!isValidName(sanitizedName)) {
             return new Response(JSON.stringify({
                 error: 'Nombre inválido. Asegúrate de que no esté vacío, no exceda los 100 caracteres y contenga caracteres válidos.'
             }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        data.name = sanitizedName; // Usar nombre sanitizado
        // --- FIN: Validaciones y Sanitización para 'name' ---


        // --- INICIO: Validaciones y Sanitización para 'email' ---
        // Sanitización básica: verificar que sea string y quitar espacios
        const sanitizedEmail = typeof data.email === 'string' ? data.email.trim() : null;

        // Validación
        if (!isValidEmail(sanitizedEmail)) {
            return new Response(JSON.stringify({
                error: 'Correo electrónico inválido. Por favor, introduce un formato de email válido (ej. usuario@dominio.com) y asegúrate de que no exceda los 254 caracteres.'
            }), {
                status: 400, // Bad Request
                headers: { 'Content-Type': 'application/json' },
            });
        }
        // Usar el email sanitizado de ahora en adelante
        data.email = sanitizedEmail;
        // --- FIN: Validaciones y Sanitización para 'email' ---


        // Validaciones básicas para otros campos obligatorios
        // Ya no necesitamos chequear data.email aquí porque lo hicimos antes
        if (!data.role) { // data.name y data.email ya fueron validados
             return new Response(JSON.stringify({ error: 'Falta campo obligatorio (cripto favorita).' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        // (Opcional) Podrías añadir validaciones similares para age, etc.

        // 2. Crear cliente de Turso
        const client = createClient({
            url: env.TURSO_DATABASE_URL,
            authToken: env.TURSO_AUTH_TOKEN,
        });

        // 3. Insertar datos en la base de datos (usando transacción)
        const tx = await client.transaction('write');
        try {
            // Insertar usuario y obtener ID (usando data.name y data.email ya sanitizados)
            const userResult = await tx.execute({
                sql: "INSERT INTO users (name, email, age) VALUES (?, ?, ?) RETURNING id;",
                // Usar los datos sanitizados
                args: [data.name, data.email, data.age ?? null],
            });
            const userId = userResult.rows[0].id;

            // ... (resto de las inserciones sin cambios) ...
             await tx.execute({
                sql: "INSERT INTO cryptocurrency_preferences (user_id, cryptocurrency) VALUES (?, ?);",
                args: [userId, data.role],
            });

            if (data.frequency) {
                await tx.execute({
                    sql: "INSERT INTO investment_frequency (user_id, frequency) VALUES (?, ?);",
                    args: [userId, data.frequency],
                });
            }

            if (data.prefer && data.prefer.length > 0) {
                for (const characteristic of data.prefer) {
                    await tx.execute({
                        sql: "INSERT INTO valued_characteristics (user_id, characteristic) VALUES (?, ?);",
                        args: [userId, characteristic],
                    });
                }
            }

            if (data.comment && data.comment.trim() !== '') {
                 await tx.execute({
                    sql: "INSERT INTO comments (user_id, comment) VALUES (?, ?);",
                    args: [userId, data.comment.trim()],
                });
            }

            await tx.commit();

        } catch (dbError) {
            await tx.rollback();
            console.error("Database Error:", dbError);
             return new Response(JSON.stringify({ error: 'Error al guardar en la base de datos.', details: dbError.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        } finally {
            client.close();
        }

        // 4. Enviar respuesta de éxito
        return new Response(JSON.stringify({ success: true, message: "Datos recibidos y guardados." }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Function Error:", error);
         let errorMessage = 'Error interno del servidor.';
         let errorStatus = 500;
         if (error instanceof SyntaxError) {
             errorMessage = 'Error en el formato del JSON enviado.';
             errorStatus = 400;
         } else if (error.message.includes('invalid name') || error.message.includes('invalid email')) { // Ejemplo si lanzaras errores específicos
             errorMessage = error.message;
             errorStatus = 400;
         }

         return new Response(JSON.stringify({ error: errorMessage, details: error.message }), {
            status: errorStatus,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}