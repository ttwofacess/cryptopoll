export async function onRequestPost(context) {
    const formData = await context.request.json();
    const { env } = context;
    const db = env.DB;

    try {
        // Start transaction
        await db.exec('BEGIN TRANSACTION');

        // 1. Insert user
        const userResult = await db.prepare(
            'INSERT INTO users (name, email, age) VALUES (?, ?, ?) RETURNING id'
        ).bind(formData.name, formData.email, formData.age).first();
        
        const userId = userResult.id;

        // 2. Insert cryptocurrency preference
        await db.prepare(
            'INSERT INTO cryptocurrency_preferences (user_id, cryptocurrency) VALUES (?, ?)'
        ).bind(userId, formData.favorite_crypto).run();

        // 3. Insert investment frequency
        await db.prepare(
            'INSERT INTO investment_frequency (user_id, frequency) VALUES (?, ?)'
        ).bind(userId, formData.investment_frequency).run();

        // 4. Insert valued characteristics
        for (const characteristic of formData.preferences) {
            await db.prepare(
                'INSERT INTO valued_characteristics (user_id, characteristic) VALUES (?, ?)'
            ).bind(userId, characteristic).run();
        }

        // 5. Insert comment if provided
        if (formData.comments) {
            await db.prepare(
                'INSERT INTO comments (user_id, comment) VALUES (?, ?)'
            ).bind(userId, formData.comments).run();
        }

        // Commit transaction
        await db.exec('COMMIT');

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        // Rollback on error
        await db.exec('ROLLBACK');
        return new Response(
            JSON.stringify({ success: false, error: error.message }), 
            { 
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
}