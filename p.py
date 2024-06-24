async def AddMessagesToThread(ThreadId, website_content, user_pitch, To, Me):
    # Create a message in the thread
    message = AIclient.beta.threads.messages.create(
        thread_id=ThreadId,
        role="user",
        # content=f"Generate a custom pitch email for a company with this website content: '{website_content}' and this user pitch: '{user_pitch}' ti gurantee them a 10x ROI on all ad spend done for them. "
        content=f"I'm selling '{user_pitch}', This is the data I have on the company and what they do from their website '{website_content}'.And this is the users pitch: '{user_pitch}' This is the name you should use to adress them in the email '{To}' from me, '{Me}' i want you to create the email wher the first lin is the subject line and then the greeting and content follows."
    )
    print("Message created")

    # Run the assistant to generate a response
    run = AIclient.beta.threads.runs.create(
        thread_id=ThreadId,
        assistant_id=ASSISTANT_ID
    )
    print("Run created")
    
    timeElapsed = 0
    timeout = 60
    interval = 5
    while (timeElapsed < timeout) :

        run_res = AIclient.beta.threads.runs.retrieve(
            thread_id=ThreadId,
            run_id=run.id
        )

        if (run_res.status == 'completed'):

            # List all messages in the thread
            messages = AIclient.beta.threads.messages.list(
                thread_id=ThreadId
            )
            print("Messages listed")

            # Print messages in reverse order
            print(messages.data[0].content[0].text.value)
            return messages.data[0].content[0].text.value
            # break

        time.sleep(interval)  # Wait for the specified interval
        timeElapsed += interval

    if timeElapsed >= timeout:
        print("Timeout reached without completion")
        return "not able to fetch response from assistant"