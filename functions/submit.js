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

// --- START: HTML Sanitization Function ---
function sanitizeHTMLWithJS(text) {
    if (!text) return text;
    
    // Crear un elemento temporal (no se añade al DOM)
    const tempElement = {
        innerHTML: '',
        textContent: ''
    };
    
    // Asignar el texto al textContent para escapar HTML
    tempElement.textContent = text;
    
    // Obtener el texto escapado
    const sanitizedText = tempElement.textContent;
    
    // Alternativa más directa: reemplazar caracteres especiales con entidades HTML
    return sanitizedText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
// --- END: HTML Sanitization Function ---

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

        // --- INICIO: Validación de edad ---
        const ageValidation = isValidAge(data.age);
        if (!ageValidation.isValid) {
            return new Response(JSON.stringify({
                error: ageValidation.error
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        // Usar el valor validado y sanitizado
        data.age = ageValidation.value;
        // --- FIN: Validación de edad ---

        // --- START: Validation for Favorite Cryptocurrency (role/dropdown) ---
        const allowedCryptoValues = new Set([
            'bitcoin',
            'ethereum',
            'litecoin', 
            'binance-coin',
            'solana',
            'other'
        ]);
        const selectedCrypto = data.role;

        // Check if it's a non-empty string first
        if (typeof selectedCrypto !== 'string' || selectedCrypto.trim() === '') {
             console.warn(`Invalid or missing cryptocurrency selection: received type ${typeof selectedCrypto}, value "${selectedCrypto}"`);
             return new Response(JSON.stringify({
                 error: 'Selección de criptomoneda favorita inválida o faltante. Por favor, elige una opción de la lista.'
             }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Trim and check against the allowed set
        const trimmedCrypto = selectedCrypto.trim(); // Trim just in case, though unlikely needed here
        if (!allowedCryptoValues.has(trimmedCrypto)) {
            console.warn(`Invalid cryptocurrency value submitted: "${trimmedCrypto}"`);
            return new Response(JSON.stringify({
                 // Be specific but don't reflect the invalid input directly back in the main error message
                 // to avoid potential reflection issues, though less likely here.
                 error: `La selección de criptomoneda favorita no es válida. Por favor, elige una de las opciones proporcionadas.`
             }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        // Use the validated (and potentially trimmed) value
        data.role = trimmedCrypto;
        // --- END: Validation for Favorite Cryptocurrency (role/dropdown) ---

        // Validaciones básicas para otros campos obligatorios
        // Ya no necesitamos chequear data.email aquí porque lo hicimos antes
        // The old basic check is no longer needed here as the dropdown validation is more specific

        // --- START: Server-Side Validation for Frequency ---
        const allowedFrequencyValues = new Set(['daily', 'weekly', 'monthly', 'rarely']);
        let validatedFrequency = null; // Default a null si es opcional y no se envía o está vacío

        if (data.frequency !== null && data.frequency !== undefined) {
            // 1. Check type: Must be a string if provided
            if (typeof data.frequency !== 'string') {
                console.warn(`Invalid frequency type: received type ${typeof data.frequency}`);
                return new Response(JSON.stringify({ error: 'Tipo de dato inválido para la frecuencia de inversión.' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            // 2. Sanitize: Trim whitespace
            const trimmedFrequency = data.frequency.trim();

            // 3. Validate: Check if the trimmed value is in the allowed set (only if it's not empty)
            if (trimmedFrequency !== '') { // Allow empty string after trim to be treated as null/not provided
                if (!allowedFrequencyValues.has(trimmedFrequency)) {
                    console.warn(`Invalid frequency value submitted: "${trimmedFrequency}"`);
                    return new Response(JSON.stringify({ error: 'La selección de frecuencia de inversión no es válida. Por favor, elige una de las opciones proporcionadas.' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
                // If valid and not empty, use the trimmed value
                validatedFrequency = trimmedFrequency;
            }
            // If the original string trimmed to empty, validatedFrequency remains null
        }
        // Update data.frequency with the validated value (could be null or a valid string)
        data.frequency = validatedFrequency;
        // --- END: Server-Side Validation for Frequency ---

        // --- START: Validation for Valued Characteristics (Checkboxes) ---
        let validatedCharacteristics = [];
        if (data.prefer && Array.isArray(data.prefer) && data.prefer.length > 0) {
            const allowedCharacteristics = new Set(['security', 'scalability', 'decentralization', 'transaction-speed', 'community']);
            for (const characteristic of data.prefer) {
                 // Ensure each item is a string and is one of the allowed values
                if (typeof characteristic === 'string' && allowedCharacteristics.has(characteristic.trim())) {
                    validatedCharacteristics.push(characteristic.trim());
                } else {
                    console.warn(`Skipping invalid characteristic value: ${characteristic}`);
                    // Decide if you want to reject the whole submission or just skip the invalid ones.
                    // Skipping is generally more user-friendly for optional multi-selects.
                    // If you want to reject, uncomment the line below:
                    // return new Response(JSON.stringify({ error: `Valor inválido encontrado en las características valoradas: ${characteristic}` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }
            }
        }
        // Use the validated array
        data.prefer = validatedCharacteristics; // Could be an empty array []
        // --- END: Validation for Valued Characteristics ---


        // --- START: Validation/Sanitization for Comment ---
        let validatedComment = null;
        if (data.comment !== null && data.comment !== undefined) {
            if (typeof data.comment !== 'string') {
                 console.warn(`Invalid comment type: received type ${typeof data.comment}`);
                 // Decide whether to reject or just ignore. Ignoring might be better for optional text.
            } else {
                const trimmedComment = data.comment.trim();
                if (trimmedComment !== '') {
                    // Sanitización HTML con JavaScript puro
                    const sanitizedComment = sanitizeHTMLWithJS(trimmedComment);
                    // Optional: Add length check
                    const maxCommentLength = 1000; // Example limit
                    /* if (trimmedComment.length > maxCommentLength) {
                         console.warn(`Comment too long, truncating.`);
                         validatedComment = trimmedComment.substring(0, maxCommentLength);
                    } else {
                         validatedComment = trimmedComment;
                    } */
                    if (sanitizedComment.length > maxCommentLength) {
                        console.warn(`Comment too long, truncating.`);
                        validatedComment = sanitizedComment.substring(0, maxCommentLength);
                    } else {
                        validatedComment = sanitizedComment;
                    }
                }
            }
        }
        data.comment = validatedComment; // Update data object
        // --- END: Validation/Sanitization for Comment ---


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
                args: [data.name, data.email, data.age],
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

            /* if (data.prefer && data.prefer.length > 0) {
                const allowedCharacteristics = new Set(['security', 'scalability', 'decentralization', 'transaction-speed', 'community']);
                for (const characteristic of data.prefer) {
                    if (typeof characteristic === 'string' && allowedCharacteristics.has(characteristic.trim())) {
                        await tx.execute({
                            sql: "INSERT INTO valued_characteristics (user_id, characteristic) VALUES (?, ?);",
                            args: [userId, characteristic.trim()],
                        });
                    } else {
                        console.warn(`Skipping invalid characteristic value: ${characteristic}`);
                      }
                }
            }

            if (data.comment && typeof data.comment === 'string' && data.comment.trim() !== '') {
                const trimmedComment = data.comment.trim();
                 await tx.execute({
                    sql: "INSERT INTO comments (user_id, comment) VALUES (?, ?);",
                    args: [userId, trimmedComment], // Use trimmed comment
                });
            } else if (data.comment) {
                // Log if comment exists but is not a string or is empty after trimming
                console.warn(`Received comment is not a non-empty string: type ${typeof data.comment}`);
              } */

            // Insertar características valoradas (si existen)
            // data.prefer ahora contiene solo valores válidos o []
            if (data.prefer.length > 0) {
                for (const characteristic of data.prefer) {
                    await tx.execute({
                        sql: "INSERT INTO valued_characteristics (user_id, characteristic) VALUES (?, ?);",
                        args: [userId, characteristic], // characteristic ya está validado y trimeado
                    });
                }
            }

            // Insertar comentario SI SE PROPORCIONÓ Y ES VÁLIDO
            if (data.comment) { // data.comment ahora contiene null o un comentario validado/trimeado/truncado
                 await tx.execute({
                    sql: "INSERT INTO comments (user_id, comment) VALUES (?, ?);",
                    args: [userId, data.comment],
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
             errorStatus = 400; // No need for specific name/email error checks here as they are handled above
         } 

         return new Response(JSON.stringify({ error: errorMessage, details: error.message }), {
            status: errorStatus,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}