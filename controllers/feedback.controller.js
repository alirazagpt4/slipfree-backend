import { submitFeedback } from '../services/feedback.service.js';

async function postFeedback(req, res) {
    const { hash } = req.params;
    const { rating, comment } = req.body;

    // Chhoti si validation — rating zaroor honi chahiye
    const validRatings = ['worst', 'not_good', 'fine', 'good', 'best'];
    if (!rating || !validRatings.includes(rating)) {
        return res.status(400).json({
            success: false,
            error: `rating must be one of: ${validRatings.join(', ')}`
        });
    }

    try {
        const feedback = await submitFeedback(hash, rating, comment);

        return res.status(201).json({
            success: true,
            feedback: {
                rating: feedback.rating,
                comment: feedback.comment,
                submitted_at: feedback.submitted_at
            }
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            error: error.message
        });
    }
}

export { postFeedback };