import { saveSegmentService, getAllSegmentsService } from '../services/customerSegment.service.js';

export const createSegment = async (req, res) => {
    try {
        const { segment_name, filter_criteria, customer_list } = req.body;

        if (!segment_name || !segment_name.trim()) {
            return res.status(400).json({ success: false, message: 'Segment name required.' });
        }

        if (!Array.isArray(customer_list) || customer_list.length === 0) {
            return res.status(400).json({ success: false, message: 'Customer list cannot be empty.' });
        }

        const data = await saveSegmentService(segment_name, filter_criteria, customer_list);
        return res.status(201).json({ success: true, message: 'Segment saved successfully.', data });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getAllSegments = async (req, res) => {
    try {
        const segments = await getAllSegmentsService();
        return res.status(200).json({ success: true, count: segments.length, segments });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};