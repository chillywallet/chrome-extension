import toast from 'react-hot-toast';
import { IoAlertCircle, IoCheckmark, IoClose } from 'react-icons/io5';

/** One visible toast at a time — new messages replace the current one. */
const ERROR_TOAST_ID = 'chilly-error-toast';
const SUCCESS_TOAST_ID = 'chilly-success-toast';

export default class Toast {
    static showSuccess(message: string) {
        toast(
            t => (
                <div className="relative flex items-center gap-3 py-0.5 min-h-5 pr-8">
                    {/* Success Icon */}
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                        <IoCheckmark className="w-5 h-5 text-white" />
                    </div>

                    {/* Message */}
                    <span className="text-sm font-regular flex-1 leading-relaxed text-white w-[250px] max-h-[300px] overflow-hidden text-ellipsis line-clamp-6">
                        {message}
                    </span>

                    {/* Close Button */}
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="absolute top-1/2 right-1.5 w-6 h-6 flex items-center justify-center rounded-md bg-white/20 text-white/80 hover:bg-white/30 hover:text-white hover:scale-110 transition-all duration-200 ease-in-out backdrop-blur-sm border-0 cursor-pointer -translate-y-1/2"
                        aria-label="Close">
                        <IoClose className="w-3 h-3" />
                    </button>
                </div>
            ),
            {
                id: SUCCESS_TOAST_ID,
                className: 'text-sm',
                duration: 4000,
                style: {
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    borderRadius: '12px',
                    boxShadow:
                        '0 10px 25px rgba(16, 185, 129, 0.3), 0 4px 12px rgba(0, 0, 0, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(8px)',
                    padding: '8px 4px',
                    width: '400px',
                },
            },
        );
    }

    static showError(message: string) {
        toast(
            t => (
                <div className="relative flex items-center gap-3 py-0.5 min-h-5 pr-8">
                    {/* Error Icon */}
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                        <IoAlertCircle className="w-5 h-5 text-white" />
                    </div>

                    {/* Message */}
                    <span className="text-sm font-regular flex-1 leading-relaxed text-white w-[250px] max-h-[300px] overflow-hidden text-ellipsis line-clamp-6">
                        {message}
                    </span>

                    {/* Close Button */}
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="absolute top-1/2 right-1.5 w-6 h-6 flex items-center justify-center rounded-md bg-white/20 text-white/80 hover:bg-white/30 hover:text-white hover:scale-110 transition-all duration-200 ease-in-out backdrop-blur-sm border-0 cursor-pointer -translate-y-1/2"
                        aria-label="Close">
                        <IoClose className="w-3 h-3" />
                    </button>
                </div>
            ),
            {
                id: ERROR_TOAST_ID,
                className: 'text-sm',
                duration: 4000,
                style: {
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(239, 68, 68, 0.3), 0 4px 12px rgba(0, 0, 0, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(8px)',
                    padding: '8px 4px',
                    width: '400px',
                },
            },
        );
    }
}
