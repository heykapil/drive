'use client';
import { Login } from '@/lib/actions';
import { FieldError } from '@/lib/helpers/fieldError';
import { useFormReset, useToastMessage } from '@/lib/helpers/form-reset-toast';
import { SubmitButton } from '@/lib/helpers/submitButton';
import { EMPTY_FORM_STATE } from '@/lib/helpers/to-form-state';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
export function LoginForm({
  message,
  callBackUrl,
}: {
  message: string;
  callBackUrl: string;
}) {
  const [captcha, setCaptcha] = useState('');
  const [hash, setHash] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [formState, action] = useActionState(Login, EMPTY_FORM_STATE);
  const [hidden, setHidden] = useState<boolean>(true);
  const noScriptFallback = useToastMessage(formState);
  const formRef = useFormReset(formState);

  useEffect(() => {
    fetchCaptcha();
  }, [formState]);

  const fetchCaptcha = async () => {
    const req = await fetch('https://api.kapil.app/api/captcha/generate');
    const res = await req.json();
    setCaptcha(res.captcha);
    setHash(res.hash);
  };

  return (
    <form
      action={action}
      ref={formRef}
      className="flex flex-col space-y-2 mb-10 mt-5"
    >
      <div className="relative mb-2 max-w-lg">
        <input
          type="text"
          className="p-2 caret-current focus:ring-neutral-500 focus:border-neutral-600 dark:focus:border-neutral-400 focus:outline-none block w-full border border-neutral-300 dark:border-neutral-700 rounded-md bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
          autoFocus
          name="username"
          minLength={3}
          maxLength={50}
          required
          placeholder="Email or username"
        />

        <FieldError formState={formState} name="username" />
        <span className="absolute inset-y-0 end-0 grid place-content-center px-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="size-4 text-neutral-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
            />
          </svg>
        </span>
      </div>
      <div className="relative mb-6 max-w-lg">
        <input
          type={hidden ? 'password' : 'text'}
          className="p-2 caret-current focus:ring-neutral-500 focus:border-neutral-600 dark:focus:border-neutral-400 focus:outline-none block w-full border border-neutral-300 dark:border-neutral-700 rounded-md bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
          name="password"
          minLength={3}
          maxLength={50}
          placeholder="Password"
          required
        />

        <FieldError formState={formState} name="password" />
        <span className="absolute inset-y-0 end-0 grid place-content-center px-4">
          <button
            onClick={(e) => {
              e.preventDefault(), setHidden((bool) => !bool);
            }}
          >
            {hidden ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="size-4 text-zinc-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="size-4 text-[#737373]"
                fill="none"
                stroke="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M15.6487 5.39489C14.4859 4.95254 13.2582 4.72021 12 4.72021C8.46997 4.72021 5.17997 6.54885 2.88997 9.71381C1.98997 10.9534 1.98997 13.037 2.88997 14.2766C3.34474 14.9051 3.83895 15.481 4.36664 16.0002M19.3248 7.69653C19.9692 8.28964 20.5676 8.96425 21.11 9.71381C22.01 10.9534 22.01 13.037 21.11 14.2766C18.82 17.4416 15.53 19.2702 12 19.2702C10.6143 19.2702 9.26561 18.9884 7.99988 18.4547"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M15 12C15 13.6592 13.6592 15 12 15M14.0996 9.85541C13.5589 9.32599 12.8181 9 12 9C10.3408 9 9 10.3408 9 12C9 12.7293 9.25906 13.3971 9.69035 13.9166"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 21.0002L22 2.7002"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        </span>
      </div>
      <div className="flex flex-row my-2 space-y-2 max-w-lg">
        {/* <span className="flex place-self-end mr-3">Captcha: </span> */}
        <div
          className="flex bg-white"
          dangerouslySetInnerHTML={{ __html: captcha }}
        />
        <button
          type="button"
          className="flex place-self-center ml-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 focus:outline-none focus:ring focus:ring-neutral-500 focus:ring-opacity-50 dark:focus:ring-neutral-400 dark:focus:ring-opacity-50 transition-colors"
          onClick={fetchCaptcha}
        >
          <svg
            fill="currentColor"
            height="20px"
            width="20px"
            version="1.1"
            viewBox="0 0 489.533 489.533"
          >
            <path d="M268.175,488.161c98.2-11,176.9-89.5,188.1-187.7c14.7-128.4-85.1-237.7-210.2-239.1v-57.6c0-3.2-4-4.9-6.7-2.9 l-118.6,87.1c-2,1.5-2,4.4,0,5.9l118.6,87.1c2.7,2,6.7,0.2,6.7-2.9v-57.5c87.9,1.4,158.3,76.2,152.3,165.6 c-5.1,76.9-67.8,139.3-144.7,144.2c-81.5,5.2-150.8-53-163.2-130c-2.3-14.3-14.8-24.7-29.2-24.7c-17.9,0-31.9,15.9-29.1,33.6 C49.575,418.961,150.875,501.261,268.175,488.161z" />
          </svg>
        </button>
        <div className="flex ml-auto">
          <Link
            className="text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:underline hover:underline-offset-2"
            href="/forgot-pass"
          >
            Forgot password?
          </Link>
        </div>
      </div>
      <div>
        <label>
          <input
            placeholder="Captcha"
            className="p-2 max-w-48 caret-current focus:ring-neutral-500 focus:border-neutral-600 dark:focus:border-neutral-400 focus:outline-none block w-full border border-neutral-300 dark:border-neutral-700 rounded-md bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
            name="captcha"
            type="text"
            value={captchaInput}
            onChange={(e) => setCaptchaInput(e.target.value)}
            required
          />
          <input type="hidden" className="hidden" name="hash" value={hash} />
        </label>
        <FieldError formState={formState} name="captcha" />
      </div>
      <div className="py-2" />
      <div className="space-y-10 max-w-lg mb-10">
        <div className="text-sm flex justify-between items-center">
          <Link
            className="px-3 py-2 border border-opacity-50 border-neutral-900 dark:border-pink-50 text-sm rounded-md font-semibold hover:border-black/[0.9] dark:hover:border-white/[0.9] hover:shadow-lg"
            href={`/register?callback=${callBackUrl}`}
          >
            Create account
          </Link>
          <SubmitButton
            type="submit"
            className="px-8 py-2  bg-neutral-900 dark:bg-pink-50 text-white dark:text-black text-sm rounded-md font-semibold hover:bg-black/[0.9] dark:hover:bg-white/[0.9] hover:shadow-lg"
            pendingState={<span className="mx-auto table">Loading...</span>}
          >
            Login
          </SubmitButton>
        </div>
      </div>
      <div className="text-sm mt-10">
        {!!message && message === 'Success' ? redirect(callBackUrl) : null}
      </div>
      {noScriptFallback}
    </form>
  );
}
