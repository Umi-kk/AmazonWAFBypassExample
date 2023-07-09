# AmazonWAFBypassExample
Uses an ANTI-GATE Template to bypass AWS WAF captcha, for example during Amazon Sign-Up.

Cost per captcha ~= $0.003, using amazon signup page for reference.


# Set up your own ANTI-GATE Task with the following settings:

Task Description: Complete the captcha challenge. Slide the shape or click end of car route.

Workers Steps: WAIT_CONTROL_TEXT_PRESENT	=> Any text present in the webpage after your desired captcha.
