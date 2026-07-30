import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
    slides: JSX.Element[];
    className?: string;
    autoPlayInterval?: number;
};

const Carousel = (props: Props) => {
    const { slides, className, autoPlayInterval = 0 } = props;
    const [currentIndex, setCurrentIndex] = useState(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const startAutoPlay = useCallback(() => {
        if (autoPlayInterval > 0) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = setInterval(() => {
                setCurrentIndex((prevIndex) => (prevIndex + 1) % slides.length);
            }, autoPlayInterval);
        }
    }, [autoPlayInterval, slides.length]);

    const nextSlide = useCallback(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % slides.length);
        startAutoPlay(); // Reset auto-play timer
    }, [slides.length, startAutoPlay]);

    const prevSlide = useCallback(() => {
        setCurrentIndex((prevIndex) => (prevIndex - 1 + slides.length) % slides.length);
        startAutoPlay(); // Reset auto-play timer
    }, [slides.length, startAutoPlay]);

    useEffect(() => {
        startAutoPlay();
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [startAutoPlay]);

    return (
        <div className={"relative w-full mx-auto overflow-hidden rounded-lg " + className}>
            {/* Slides */}
            <div
                className="flex transition-transform duration-500"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
                {slides.map((slide, index) => (
                    <div key={index} className="w-full flex-shrink-0">
                        {slide}
                    </div>
                ))}
            </div>

            {/* Navigation Buttons */}
            {slides.length > 1 && (
                <>
                    <button
                        onClick={prevSlide}
                        className="absolute top-1/2 left-4 -translate-y-1/2 bg-gray-800 text-white p-2 rounded-full hover:bg-gray-700"
                    >
                        &#8249;
                    </button>
                    <button
                        onClick={nextSlide}
                        className="absolute top-1/2 right-4 -translate-y-1/2 bg-gray-800 text-white p-2 rounded-full hover:bg-gray-700"
                    >
                        &#8250;
                    </button>

                    {/* Dots */}
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
                        {slides.map((_, index) => (
                            <div
                                key={index}
                                className={`w-3 h-3 rounded-full ${index === currentIndex ? "bg-primary" : "bg-gray-400"
                                    }`}
                                onClick={() => setCurrentIndex(index)}
                            ></div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default Carousel;