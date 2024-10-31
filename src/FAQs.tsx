import React from 'react';
import { Image } from 'react-bootstrap';

const FAQs: React.FC = () => {
    return (
        <>
            <h2>FAQs</h2>
            <h4>1. Why do you need to know my marginal tax rate?</h4>
            <p>
                FSA and HSA contributions are tax-deductible, meaning that you can subtract them from your taxable income. For
                example, if you have a 25%
                tax rate and contribute $5,000 of your money to an HSA, you'll pay $1,250 less in taxes this year. Win!
            </p>

            <h4>2. How can I estimate my future medical expenses?</h4>
            <p>
                The best way to tell what kind of medical expenses you'll have in the future is to look at your past. Log in to DMBA, navigate
                to <a href="https://www.dmba.com/sc/medical/HealthClaims.aspx?type=medical">My Health &gt; Claims</a>, and click "Create Claims History Report."
                Select all family members, both prescription and medical categories, and include the past 2 years. Select a "Detail" report. You should see all
                EOBs for that time range which will list all the associated medical costs you submitted through insurance.
            </p>

            <h4>3. Negotiated price? What's that?</h4>
            <p>
                Helping to pay for medical expenses is a big part of what insurance companies do. They also negotiate with medical
                providers to get a lower price for services and reject any charges that are too high.
                You get the negotiated rates at in-network providers, <i>no matter which health plan you choose</i>.
            </p>
            <p>
                You can see how much your insurance company has negotiated off your total bill by looking EOB report.
                Looks for words like "Over allowed amount" or "Discounted price" on the EOB.
                The remaining cost is divided between you and the insurance company. In the example below, the provider wanted to bill
                $100. The insurance company negotiated it down by 28.81 + 25.00, leaving $46.19 as the negotiated amount.
                $20.00 of that $46.19 was paid as the copay, and DMBA paid the remaining $26.19.
            </p>
            <Image src="/img/eob-example.jpg" fluid={true} />

            <h4>4. How much does tool this assume I'm contributing to my HSA/FSA?</h4>
            <p>
                This tool assumes you are maximizing your tax exemptions by contributing the max amount to your HSA/FSA, taking
                into account legal limits for the upcoming year and any employer contributions. I could add a field for you
                to input your own contribution amount, but it would be complicated to add, and may not have a sizable impact
                on the results. If you plan to contribute less than the max, you can subtract your contribution amounts and
                tax savings from the the total cost of each plan.
            </p>

            <h4>5. This tool doesn't show the <i>hundreds of thousands of dollars</i> an HSA can save me over the years!</h4>
            <p>
                Good for you for picking up on that! Yes, HSAs have some amazing superpowers that aren't accounted for in this tool:
            </p>
            <p>
                <b>First superpower: You keep the money and you use it whenever you want.</b> <i>FSAs</i> (the kind you get with
                the PPO plan) are "use it or lose it" -- if you don't spend the money by the end of the year, you've just made
                a generous contribution to the FSA plan administrator. But HSAs are truly yours forever, and you can use them
                for any medical expenses you ever incur after the opening date of the HSA-- even when you're no longer on DMBA's plans!
            </p>
            <p>
                <b>Second superpower: Investment.</b> FSAs sit in a cash account and earn no interest. So technically, the money
                you put in an FSA is slowly evaporating to inflation over the course of the year. But HSAs usually live in a
                brokerage account, where cash by itself can often earn enough interest to outpace inflation.
            </p>
            <p>
                But even better, you can invest your HSA in index funds, where it can grow 8-10% on average. This is
                <i>incredibly</i> powerful. If you're in your early 20s, you can expect each $1,000 you invest in your HSA today
                to grow to <i>$88,000</i> by the time you retire. That's not a typo-- that's the power of compound interest--
                the eighth wonder of the world!
            </p>
            <p>
                <b>Third superpower: Triple tax advantage!</b> Like FSAs, HSAs are tax-deductible on the front-end. But they also
                grow tax-free, and are tax-free on withdrawal for medical expenses. HSA is the best parts of an FSA plus the best
                parts of a Roth IRA combined!
            </p>
            <p>
                Those are some amazing superpowers. But those are long-term financial benefits that play out over the rest of our
                life. In order to provide an apples-to-apples comparison to PPO plans (which have zero long-term financial benefits),
                I had to ignore all of HSA's superpowers for this tool. Just know that they're there, and they're amazing:
            </p>
            <div className="d-flex justify-content-center">
                    <iframe width="560" height="315" src="https://www.youtube.com/embed/xn6FtTZYeWE" title="YouTube video player"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen={true}></iframe>
                </div>
        </>
    );
};

export default FAQs;