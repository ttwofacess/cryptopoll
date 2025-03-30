// functions/submit.js
import { createClient } from "@libsql/client";

// La función onRequestPost se ejecuta cuando llega una petición POST a /submit
export async function onRequestPost({ request, env }) {
    try {
        // 1. Parsear los datos JSON del cuerpo de la petición
        const data = await request.json();

        // Validaciones básicas (puedes añadir más)
        if (!data.name || !data.email || !data.role) {
             return new Response(JSON.stringify({ error: 'Faltan campos obligatorios (nombre, email, cripto favorita).' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 2. Crear cliente de Turso usando las variables de entorno
        // Estas variables (TURSO_DATABASE_URL y TURSO_AUTH_TOKEN)
        // DEBEN configurarse en el dashboard de Cloudflare Pages.
        const client = createClient({
            url: env.TURSO_DATABASE_URL,
            authToken: env.TURSO_AUTH_TOKEN,
        });

        // 3. Insertar datos en la base de datos (usando transacción para consistencia)
        const tx = await client.transaction('write');
        try {
            // Insertar usuario y obtener ID
            const userResult = await tx.execute({
                sql: "INSERT INTO users (name, email, age) VALUES (?, ?, ?) RETURNING id;",
                args: [data.name, data.email, data.age ?? null], // Usar null si age no viene
            });
            const userId = userResult.rows[0].id;

            // Insertar preferencia de criptomoneda
            await tx.execute({
                sql: "INSERT INTO cryptocurrency_preferences (user_id, cryptocurrency) VALUES (?, ?);",
                args: [userId, data.role],
            });

            // Insertar frecuencia de inversión (si se proporcionó)
            if (data.frequency) {
                await tx.execute({
                    sql: "INSERT INTO investment_frequency (user_id, frequency) VALUES (?, ?);",
                    args: [userId, data.frequency],
                });
            }

            // Insertar características valoradas (si se proporcionaron)
            if (data.prefer && data.prefer.length > 0) {
                for (const characteristic of data.prefer) {
                    await tx.execute({
                        sql: "INSERT INTO valued_characteristics (user_id, characteristic) VALUES (?, ?);",
                        args: [userId, characteristic],
                    });
                }
            }

            // Insertar comentario (si se proporcionó)
            if (data.comment && data.comment.trim() !== '') {
                 await tx.execute({
                    sql: "INSERT INTO comments (user_id, comment) VALUES (?, ?);",
                    args: [userId, data.comment],
                });
            }

            // Confirmar la transacción
            await tx.commit();

        } catch (dbError) {
            // Si algo falla en la DB, deshacer la transacción
            await tx.rollback();
            console.error("Database Error:", dbError);
            // Devolver un error más específico si es posible
             return new Response(JSON.stringify({ error: 'Error al guardar en la base de datos.', details: dbError.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        } finally {
            // Cerrar cliente (importante en entornos serverless de larga duración, aunque aquí es menos crítico)
            client.close();
        }

        // 4. Enviar respuesta de éxito al frontend
        return new Response(JSON.stringify({ success: true, message: "Datos recibidos y guardados." }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        // Capturar errores generales (ej. JSON mal formado)
        console.error("Function Error:", error);
         return new Response(JSON.stringify({ error: 'Error interno del servidor.', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}