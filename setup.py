from setuptools import setup, find_packages

with open("requirements.txt") as f:
    install_requires = f.read().strip().split("\n")

setup(
    name="claude_copilot",
    version="0.1.0",
    description="In-app Claude assistant that guides users through the correct ERPNext process on every screen.",
    author="Intelloger",
    author_email="erpnext@intelloger.com",
    packages=find_packages(),
    zip_safe=False,
    include_package_data=True,
    install_requires=install_requires,
)
