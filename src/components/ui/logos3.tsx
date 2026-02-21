// This template requires the Embla Auto Scroll plugin to be installed:
//
// npm install embla-carousel-auto-scroll

"use client";

import AutoScroll from "embla-carousel-auto-scroll";

import {
    Carousel,
    CarouselContent,
    CarouselItem,
} from "@/components/ui/carousel";

interface Logo {
    id: string;
    description: string;
    image: string;
    className?: string;
}

interface Logos3Props {
    heading?: string;
    logos?: Logo[];
    className?: string;
}

const Logos3 = ({
    heading = "Trusted by these companies",
    logos = [
        {
            id: "logo-1",
            description: "Logo 1",
            image: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/astro-wordmark.svg",
            className: "h-7 w-auto",
        },
        {
            id: "logo-2",
            description: "Logo 2",
            image: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/figma-wordmark.svg",
            className: "h-7 w-auto",
        },
        {
            id: "logo-3",
            description: "Logo 3",
            image: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/nextjs-wordmark.svg",
            className: "h-7 w-auto",
        },
        {
            id: "logo-4",
            description: "Logo 4",
            image: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/react-wordmark.svg",
            className: "h-7 w-auto",
        },
        {
            id: "logo-5",
            description: "Logo 5",
            image: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/shadcn-ui-wordmark.svg",
            className: "h-7 w-auto",
        },
        {
            id: "logo-6",
            description: "Logo 6",
            image: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/supabase-wordmark.svg",
            className: "h-7 w-auto",
        },
        {
            id: "logo-7",
            description: "Logo 7",
            image: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/tailwind-wordmark.svg",
            className: "h-4 w-auto",
        },
        {
            id: "logo-8",
            description: "Logo 8",
            image: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/vercel-wordmark.svg",
            className: "h-7 w-auto",
        },
    ],
}: Logos3Props) => {
    return (
        <section className="py-20 overflow-hidden">
            <div className="container flex flex-col items-center text-center">
                <h1 className="my-6 text-xl font-bold text-pretty lg:text-2xl text-zinc-400">
                    {heading}
                </h1>
            </div>
            <div className="pt-6 relative">
                {/* Fade edges */}
                <div className="absolute inset-y-0 left-0 w-20 bg-linear-to-r from-black to-transparent z-10"></div>
                <div className="absolute inset-y-0 right-0 w-20 bg-linear-to-l from-black to-transparent z-10"></div>

                <div className="relative mx-auto flex items-center justify-center">
                    <Carousel
                        opts={{ loop: true }}
                        plugins={[AutoScroll({ playOnInit: true, speed: 1.5 })]}
                    >
                        <CarouselContent className="ml-0">
                            {logos.map((logo) => (
                                <CarouselItem
                                    key={logo.id}
                                    className="flex basis-1/3 justify-center pl-0 sm:basis-1/4 md:basis-1/5 lg:basis-1/6"
                                >
                                    <div className="flex shrink-0 items-center justify-center transition-all duration-300 hover:scale-125 cursor-pointer py-4">
                                        <div className="px-6">
                                            <img
                                                src={logo.image}
                                                alt={logo.description}
                                                className={`${logo.className} object-contain`}
                                            />
                                        </div>
                                    </div>
                                </CarouselItem>
                            ))}
                        </CarouselContent>
                    </Carousel>
                </div>
            </div>
        </section>
    );
};

export { Logos3 };
