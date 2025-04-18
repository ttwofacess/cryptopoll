// functions/submit.js
import { createClient } from "@libsql/client";

// Función auxiliar para validar el nombre (puedes hacerla más compleja si necesitas)
function isValidName(name) {
    if (!name || typeof name !== 'string') {
        return false;
    }
    const trimmedName = name.trim();
    // 1. No vacío después de quitar espacios
    if (trimmedName.length === 0) {
        return false;
    }
    // 2. Longitud razonable (ej. máximo 100 caracteres)
    if (trimmedName.length > 100) {
        return false;
    }
    // 3. (Opcional) Verificar caracteres permitidos.
    //    Este regex permite letras (incluyendo acentos comunes), espacios, apóstrofes y guiones.
    //    Ajusta según tus necesidades específicas. ¡Cuidado con ser demasiado restrictivo!
    const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]+$/;
    if (!nameRegex.test(trimmedName)) {
        // Podrías querer loggear qué caracter falló aquí para depuración
        console.warn(`Invalid characters detected in name: ${trimmedName}`);
        return false;
    }

    return true; // Pasa todas las validaciones
}


export async function onRequestPost({ request, env }) {
    try {
        const data = await request.json();

        // --- INICIO: Validaciones y Sanitización para 'name' ---

        // Sanitización básica: quitar espacios al inicio y al final
        // const sanitizedName = data.name ? data.name.trim() : null;

        // Sanitización básica: verificar que sea string y quitar espacios
        const sanitizedName = typeof data.name === 'string' ? data.name.trim() : String(data.name).trim();

        // Validación
        if (!isValidName(sanitizedName)) {
             return new Response(JSON.stringify({
                 error: 'Nombre inválido. Asegúrate de que no esté vacío, no exceda los 100 caracteres y contenga caracteres válidos.'
             }), {
                status: 400, // Bad Request
                headers: { 'Content-Type': 'application/json' },
            });
        }
        // Usar el nombre sanitizado de ahora en adelante
        data.name = sanitizedName;

        // --- FIN: Validaciones y Sanitización para 'name' ---


        // Validaciones básicas para otros campos obligatorios
        if (!data.email || !data.role) { // Ya no necesitamos chequear data.name aquí porque lo hicimos antes
             return new Response(JSON.stringify({ error: 'Faltan campos obligatorios (email, cripto favorita).' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        // (Opcional) Podrías añadir validaciones similares para email, age, etc.

        // 2. Crear cliente de Turso
        const client = createClient({
            url: env.TURSO_DATABASE_URL,
            authToken: env.TURSO_AUTH_TOKEN,
        });

        // 3. Insertar datos en la base de datos (usando transacción)
        const tx = await client.transaction('write');
        try {
            // Insertar usuario y obtener ID (usando data.name ya sanitizado)
            const userResult = await tx.execute({
                sql: "INSERT INTO users (name, email, age) VALUES (?, ?, ?) RETURNING id;",
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
                    // Aplicar trim también al comentario por consistencia
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
        // Capturar errores generales (ej. JSON mal formado o error en isValidName)
        console.error("Function Error:", error);
         // Distinguir si el error es por JSON mal formado
         let errorMessage = 'Error interno del servidor.';
         let errorStatus = 500;
         if (error instanceof SyntaxError) {
             errorMessage = 'Error en el formato del JSON enviado.';
             errorStatus = 400; // Bad Request si el JSON está mal
         } else if (error.message.includes('invalid name')) { // Ejemplo si lanzaras errores específicos
             errorMessage = error.message;
             errorStatus = 400;
         }

         return new Response(JSON.stringify({ error: errorMessage, details: error.message }), {
            status: errorStatus,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}