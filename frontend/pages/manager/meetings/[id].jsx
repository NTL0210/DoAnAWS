import Link from 'next/link';
import { motion } from 'framer-motion';
import MeetingDetail from '../../../src/components/meetings/MeetingDetail';

export default function MeetingDetailPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gray-50 dark:bg-gray-900"
    >
      <MeetingDetail />
    </motion.div>
  );
}
