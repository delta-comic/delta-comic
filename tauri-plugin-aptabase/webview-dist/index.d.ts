type Props = {
    [key: string]: string | number;
};
export declare function trackEvent(name: string, props?: Props): Promise<void>;
export {};
